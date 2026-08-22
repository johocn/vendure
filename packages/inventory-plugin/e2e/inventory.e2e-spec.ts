import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { testConfig, TEST_SETUP_TIMEOUT_MS } from '../../../e2e-common/test-config';
import { InventoryPlugin } from '../src/inventory.plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

async function importProducts(adminClient: any, csvPath: string) {
    const products = {
        items: [],
        totalItems: 0,
    };
    // 读取 CSV 商品用于后续调拨
    const [result] = await Promise.all([
        adminClient.query(gql`
            query {
                products(options: { take: 3 }) {
                    items { id variants { id sku } }
                    totalItems
                }
            }
        `),
    ]);
    products.items = result.products.items;
    products.totalItems = result.products.totalItems;
    return products;
}

describe('InventoryPlugin · 移库账本化（方案A验证）', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [InventoryPlugin.init()],
            // 为 variantNearbyStock 排序/门禁验证注册 StockLocation 自定义字段
            customFields: {
                StockLocation: [
                    { name: 'lat', type: 'float', nullable: true },
                    { name: 'lng', type: 'float', nullable: true },
                    { name: 'serviceCities', type: 'text', list: true, nullable: true },
                ],
            },
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 0,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('调拨闭环 ship→receive 写入成对 ledger 流水且库存水位正确', async () => {
        // 准备两个仓库：默认 id=1 + 新建 id=2
        await adminClient.query(gql`
            mutation { createStockLocation(input: { name: "Warehouse B" }) { id name } }
        `);
        const locs = await adminClient.query(gql`
            query { stockLocations { items { id name } } }
        `);
        const locations = locs.stockLocations.items;
        const source = locations.find((l: any) => l.name === 'Primary') ?? locations[0];
        const target = locations.find((l: any) => l.id !== source.id)!;

        // 取一个变体，先给源仓补足库存
        const products = await importProducts(adminClient, '');
        const variant = products.items[0].variants[0];

        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variant.id}", stockLocationId: "${source.id}", stockOnHand: 100) }
        `);

        // 创建调拨单：源仓 → 目标仓，数量 10
        const { createStockMoveOrder } = await adminClient.query(gql`
            mutation {
                createStockMoveOrder(input: {
                    sourceLocationId: "${source.id}"
                    targetLocationId: "${target.id}"
                    lines: [{ productVariantId: "${variant.id}", quantity: 10 }]
                    note: "e2e-move"
                }) { id code state }
            }
        `);
        expect(createStockMoveOrder.state).toBe('Pending');

        // ship：源仓 -10
        const shipped = await adminClient.query(gql`
            mutation { shipStockMoveOrder(id: "${createStockMoveOrder.id}") { id code state shippedAt } }
        `);
        expect(shipped.shipStockMoveOrder.state).toBe('InTransit');

        // ship 后 ledger 应有一条 source-out
        const led1 = await adminClient.query(gql`
            query { stockLedger(bizType: "stockMove", bizCode: "${createStockMoveOrder.code}") { items { direction quantity stockLocationId otherLocationId bizType bizCode } totalItems } }
        `);
        expect(led1.stockLedger.totalItems).toBe(1);
        expect(led1.stockLedger.items[0]).toMatchObject({
            direction: 'out',
            quantity: 10,
            stockLocationId: source.id,
            otherLocationId: target.id,
            bizType: 'stockMove',
            bizCode: createStockMoveOrder.code,
        });

        // receive：目标仓 +10
        const received = await adminClient.query(gql`
            mutation { receiveStockMoveOrder(id: "${createStockMoveOrder.id}") { id state receivedAt } }
        `);
        expect(received.receiveStockMoveOrder.state).toBe('Received');

        // receive 后应有 2 条成对流水
        const led2 = await adminClient.query(gql`
            query { stockLedger(bizType: "stockMove", bizCode: "${createStockMoveOrder.code}") { items { direction quantity stockLocationId otherLocationId } totalItems } }
        `);
        expect(led2.stockLedger.totalItems).toBe(2);
        const outs = led2.stockLedger.items.filter((i: any) => i.direction === 'out');
        const ins = led2.stockLedger.items.filter((i: any) => i.direction === 'in');
        expect(outs).toHaveLength(1);
        expect(ins).toHaveLength(1);
        expect(outs[0].stockLocationId).toBe(source.id);
        expect(ins[0].stockLocationId).toBe(target.id);

        // 库存水位：源仓 90 / 目标仓 10
        const levels = await adminClient.query(gql`
            query { stockLevels(locationId: "${source.id}") { items { productVariantId stockOnHand } } }
        `);
        const srcLevel = levels.stockLevels.items.find((l: any) => String(l.productVariantId) === String(variant.id));
        expect(srcLevel.stockOnHand).toBe(90);
    }, TEST_SETUP_TIMEOUT_MS);

    it('调拨取消 ship→cancel 回滚源仓并写 ledger', async () => {
        const locs = await adminClient.query(gql`
            query { stockLocations { items { id name } } }
        `);
        const locations = locs.stockLocations.items;
        const source = locations.find((l: any) => l.name !== 'Warehouse B') ?? locations[0];
        const target = locations.find((l: any) => l.name === 'Warehouse B') ?? locations[0];

        const products = await importProducts(adminClient, '');
        const variant = products.items[0].variants[0];
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variant.id}", stockLocationId: "${source.id}", stockOnHand: 50) }
        `);

        const { createStockMoveOrder } = await adminClient.query(gql`
            mutation {
                createStockMoveOrder(input: {
                    sourceLocationId: "${source.id}"
                    targetLocationId: "${target.id}"
                    lines: [{ productVariantId: "${variant.id}", quantity: 5 }]
                    note: "e2e-cancel"
                }) { id code state }
            }
        `);
        await adminClient.query(gql`
            mutation { shipStockMoveOrder(id: "${createStockMoveOrder.id}") { id state } }
        `);
        // ship 后源仓扣减到 45
        const beforeCancel = await adminClient.query(gql`
            query { stockLevels(locationId: "${source.id}") { items { productVariantId stockOnHand } } }
        `);
        const srcBefore = beforeCancel.stockLevels.items.find((l: any) => String(l.productVariantId) === String(variant.id));
        expect(srcBefore.stockOnHand).toBe(45);

        const cancelled = await adminClient.query(gql`
            mutation { cancelStockMoveOrder(id: "${createStockMoveOrder.id}") { id state cancelledAt } }
        `);
        expect(cancelled.cancelStockMoveOrder.state).toBe('Cancelled');

        // cancel 回滚：源仓回到 50
        const afterCancel = await adminClient.query(gql`
            query { stockLevels(locationId: "${source.id}") { items { productVariantId stockOnHand } } }
        `);
        const srcAfter = afterCancel.stockLevels.items.find((l: any) => String(l.productVariantId) === String(variant.id));
        expect(srcAfter.stockOnHand).toBe(50);

        // watch ledger：rollback-source 一条 in
        const led = await adminClient.query(gql`
            query { stockLedger(bizType: "stockMove", bizCode: "${createStockMoveOrder.code}") { items { direction quantity stockLocationId } totalItems } }
        `);
        expect(led.stockLedger.totalItems).toBe(2);
        const roll = led.stockLedger.items.find((i: any) => i.stockLocationId === source.id && i.direction === 'in');
        expect(roll).toBeDefined();
        expect(roll.quantity).toBe(5);
    }, TEST_SETUP_TIMEOUT_MS);

    it('variantNearbyStock 双仓按距离排序 + 服务城市过滤', async () => {
        const products = await importProducts(adminClient, '');
        const product = products.items[0];
        const variant = product.variants[0];

        // 准备两个带坐标的仓库：近仓（成都）与远仓（北京）
        const nearLoc = await adminClient.query(gql`
            mutation {
                createStockLocation(input: {
                    name: "成都仓"
                    customFields: { lat: 30.66, lng: 104.06, serviceCities: ["成都", "绵阳"] }
                }) { id name }
            }
        `);
        const farLoc = await adminClient.query(gql`
            mutation {
                createStockLocation(input: {
                    name: "北京仓"
                    customFields: { lat: 39.9, lng: 116.4, serviceCities: ["北京"] }
                }) { id name }
            }
        `);
        const nearId = nearLoc.createStockLocation.id;
        const farId = farLoc.createStockLocation.id;

        // 近仓 30 件、远仓 5 件
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variant.id}", stockLocationId: "${nearId}", stockOnHand: 30) }
        `);
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variant.id}", stockLocationId: "${farId}", stockOnHand: 5) }
        `);

        // 以成都为锚点查询（无 city 参数时按距离升序）——variantNearbyStock 为 Shop API
        const byDist = await shopClient.query(gql`
            query {
                variantNearbyStock(productId: "${product.id}", variantId: "${variant.id}", lat: 30.66, lng: 104.06) {
                    distanceKm
                    location { id name }
                    variants { variantId stockOnHand stockAllocated stockAvailable }
                }
            }
        `);
        const nearRows = byDist.variantNearbyStock.filter((r: any) => r.location.id === nearId);
        const farRows = byDist.variantNearbyStock.filter((r: any) => r.location.id === farId);
        expect(nearRows).toHaveLength(1);
        expect(farRows).toHaveLength(1);
        // 近仓距离更小 → 排在远仓之前
        expect(nearRows[0].distanceKm).toBeLessThan(farRows[0].distanceKm);
        // 库存三口径
        expect(nearRows[0].variants[0]).toMatchObject({
            variantId: variant.id,
            stockOnHand: 30,
            stockAllocated: 0,
            stockAvailable: 30,
        });
        expect(farRows[0].variants[0].stockAvailable).toBe(5);

        // 带 city 过滤：成都客户只看得到成都仓
        const byCity = await shopClient.query(gql`
            query {
                variantNearbyStock(productId: "${product.id}", variantId: "${variant.id}", lat: 30.66, lng: 104.06, city: "成都") {
                    location { id }
                }
            }
        `);
        const cityIds = byCity.variantNearbyStock.map((r: any) => r.location.id);
        expect(cityIds).toContain(nearId);
        expect(cityIds).not.toContain(farId);
    }, TEST_SETUP_TIMEOUT_MS);

    it('供应商 CRUD + 唯一 code 校验', async () => {
        const { createSupplier } = await adminClient.query(gql`
            mutation {
                createSupplier(input: {
                    code: "SUP-001"
                    name: "华东供应商"
                    taxNumber: "913100001"
                    contactName: "张三"
                    contactPhone: "13800000000"
                    address: "上海"
                    settlementDays: 30
                    note: "e2e"
                }) { id code name taxNumber contactName settlementDays }
            }
        `);
        expect(createSupplier).toMatchObject({
            code: 'SUP-001',
            name: '华东供应商',
            taxNumber: '913100001',
            contactName: '张三',
            settlementDays: 30,
        });

        // 同 code 重复创建报错
        let duplicateRejected = false;
        try {
            await adminClient.query(gql`
                mutation {
                    createSupplier(input: { code: "SUP-001", name: "重复" }) { id }
                }
            `);
        } catch (e: any) {
            duplicateRejected = String(e?.message ?? '').includes('already exists');
        }
        expect(duplicateRejected).toBe(true);

        // 编辑 + 删除
        const { updateSupplier } = await adminClient.query(gql`
            mutation { updateSupplier(id: "${createSupplier.id}", input: { contactName: "李四", settlementDays: 60 }) { id contactName settlementDays } }
        `);
        expect(updateSupplier.contactName).toBe('李四');
        expect(updateSupplier.settlementDays).toBe(60);

        const { deleteSupplier } = await adminClient.query(gql`
            mutation { deleteSupplier(id: "${createSupplier.id}") }
        `);
        expect(deleteSupplier).toBe(true);
    }, TEST_SETUP_TIMEOUT_MS);

    it('采购整单收货：库存增加 + purchase 账本', async () => {
        // 建供应商（删除一个空供应商后重新建，保证是干净 id）
        const { createSupplier } = await adminClient.query(gql`
            mutation {
                createSupplier(input: { code: "SUP-PO-001", name: "采购供应商" }) { id code }
            }
        `);
        const locs = await adminClient.query(gql`
            query { stockLocations { items { id name } } }
        `);
        const location = locs.stockLocations.items[0];
        const products = await importProducts(adminClient, '');
        const variant = products.items[0].variants[0];

        // 建采购单（2 行）
        const { createPurchaseOrder } = await adminClient.query(gql`
            mutation {
                createPurchaseOrder(input: {
                    supplierId: "${createSupplier.id}"
                    targetLocationId: "${location.id}"
                    lines: [
                        { productVariantId: "${variant.id}", quantity: 10, unitPrice: 500 }
                    ]
                    note: "e2e-po"
                }) { id code state totalAmount lines { id quantity receivedQuantity unitPrice amount } }
            }
        `);
        expect(createPurchaseOrder.state).toBe('Draft');
        expect(createPurchaseOrder.totalAmount).toBe(10 * 500);
        expect(createPurchaseOrder.lines[0].amount).toBe(10 * 500);

        // 下单：Draft → Ordered
        const { placePurchaseOrder } = await adminClient.query(gql`
            mutation { placePurchaseOrder(id: "${createPurchaseOrder.id}") { id state orderedAt } }
        `);
        expect(placePurchaseOrder.state).toBe('Ordered');

        // 收货：整单数量
        // 先记录收货前库存，用增量断言（避免依赖前序测试残留库存）
        const beforeLvl = await adminClient.query(gql`
            query { stockLevels(locationId: "${location.id}") { items { productVariantId stockOnHand } } }
        `);
        const beforeOnHand =
            beforeLvl.stockLevels.items.find((l: any) => String(l.productVariantId) === String(variant.id))?.stockOnHand ??
            0;

        const { receivePurchaseOrder } = await adminClient.query(gql`
            mutation {
                receivePurchaseOrder(id: "${createPurchaseOrder.id}", lines: [
                    { lineId: "${createPurchaseOrder.lines[0].id}", quantity: 10 }
                ]) { id state lines { receivedQuantity } }
            }
        `);
        expect(receivePurchaseOrder.state).toBe('Received');
        expect(receivePurchaseOrder.lines[0].receivedQuantity).toBe(10);

        // 库存 +10
        const after = await adminClient.query(gql`
            query { stockLevels(locationId: "${location.id}") { items { productVariantId stockOnHand } } }
        `);
        const lvl = after.stockLevels.items.find((l: any) => String(l.productVariantId) === String(variant.id));
        expect(lvl.stockOnHand).toBe(beforeOnHand + 10);

        // purchase 账本
        const led = await adminClient.query(gql`
            query { stockLedger(bizType: "purchase", bizCode: "${createPurchaseOrder.code}") {
                items { bizType direction quantity stockLocationId bizCode } totalItems }
            }
        `);
        expect(led.stockLedger.totalItems).toBe(1);
        expect(led.stockLedger.items[0]).toMatchObject({
            bizType: 'purchase',
            direction: 'in',
            quantity: 10,
            stockLocationId: location.id,
            bizCode: createPurchaseOrder.code,
        });

        // 完成：Received → Completed
        const { completePurchaseOrder } = await adminClient.query(gql`
            mutation { completePurchaseOrder(id: "${createPurchaseOrder.id}") { id state completedAt } }
        `);
        expect(completePurchaseOrder.state).toBe('Completed');
    }, TEST_SETUP_TIMEOUT_MS);

    it('采购分批收货：PartiallyReceived 中间态 + 终态 Received', async () => {
        const { createSupplier } = await adminClient.query(gql`
            mutation { createSupplier(input: { code: "SUP-PO-002", name: "分批供应商" }) { id } }
        `);
        const locs = await adminClient.query(gql`
            query { stockLocations { items { id } } }
        `);
        const location = locs.stockLocations.items[0];
        const products = await importProducts(adminClient, '');
        const v2 = products.items[0].variants[0];

        const { createPurchaseOrder } = await adminClient.query(gql`
            mutation {
                createPurchaseOrder(input: {
                    supplierId: "${createSupplier.id}"
                    targetLocationId: "${location.id}"
                    lines: [{ productVariantId: "${v2.id}", quantity: 20, unitPrice: 300 }]
                }) { id code state lines { id quantity unitPrice } }
            }
        `);
        await adminClient.query(gql`
            mutation { placePurchaseOrder(id: "${createPurchaseOrder.id}") { id state } }
        `);

        // 超收拒绝：在 Ordered 态尝试收 25 > 20
        let overRejected = false;
        try {
            await adminClient.query(gql`
                mutation {
                    receivePurchaseOrder(id: "${createPurchaseOrder.id}", lines: [
                        { lineId: "${createPurchaseOrder.lines[0].id}", quantity: 25 }
                    ]) { id state }
                }
            `);
        } catch (e: any) {
            overRejected = String(e?.message ?? '').includes('over-received');
        }
        expect(overRejected).toBe(true);

        // 第一批 8
        const r1 = await adminClient.query(gql`
            mutation {
                receivePurchaseOrder(id: "${createPurchaseOrder.id}", lines: [
                    { lineId: "${createPurchaseOrder.lines[0].id}", quantity: 8 }
                ]) { id state lines { receivedQuantity } }
            }
        `);
        expect(r1.receivePurchaseOrder.state).toBe('PartiallyReceived');
        expect(r1.receivePurchaseOrder.lines[0].receivedQuantity).toBe(8);

        // 第二批 12 → 全部收满 → Received
        const r2 = await adminClient.query(gql`
            mutation {
                receivePurchaseOrder(id: "${createPurchaseOrder.id}", lines: [
                    { lineId: "${createPurchaseOrder.lines[0].id}", quantity: 12 }
                ]) { id state lines { receivedQuantity } }
            }
        `);
        expect(r2.receivePurchaseOrder.state).toBe('Received');
        expect(r2.receivePurchaseOrder.lines[0].receivedQuantity).toBe(20);

        // 已收货禁止取消
        let cancelRejected = false;
        try {
            await adminClient.query(gql`
                mutation { cancelPurchaseOrder(id: "${createPurchaseOrder.id}") { id state } }
            `);
        } catch (e: any) {
            cancelRejected = String(e?.message ?? '').includes('Cannot cancel');
        }
        expect(cancelRejected).toBe(true);
    }, TEST_SETUP_TIMEOUT_MS);

    it('采购权限：无 ManagePurchase 被拒，有权限角色成功', async () => {
        // 准备供应商/仓库/变体（super admin）
        const { createSupplier } = await adminClient.query(gql`
            mutation { createSupplier(input: { code: "SUP-PERM-001", name: "权限供应商" }) { id } }
        `);
        const locs = await adminClient.query(gql`
            query { stockLocations { items { id } } }
        `);
        const location = locs.stockLocations.items[0];
        const products = await importProducts(adminClient, '');
        const v = products.items[0].variants[0];

        // 取 role-sync 在 bootstrap 创建的角色：inventory-staff（无 ManagePurchase）/ manager（有 ManagePurchase）
        const rolesRes = await adminClient.query(gql`
            query { roles { items { id code } } }
        `);
        const roles = rolesRes.roles.items;
        const staffRole = roles.find((r: any) => r.code === 'inventory-staff');
        const managerRole = roles.find((r: any) => r.code === 'manager');
        expect(staffRole).toBeDefined();
        expect(managerRole).toBeDefined();

        // 建两个管理员，分别挂无权限/有权限角色
        const emailDenied = 'purchase-denied@test.com';
        const emailGranted = 'purchase-granted@test.com';
        await adminClient.query(gql`
            mutation {
                createAdministrator(input: {
                    emailAddress: "${emailDenied}"
                    firstName: "deny"
                    lastName: "deny"
                    password: "test12345"
                    roleIds: ["${staffRole.id}"]
                }) { id }
            }
        `);
        await adminClient.query(gql`
            mutation {
                createAdministrator(input: {
                    emailAddress: "${emailGranted}"
                    firstName: "grant"
                    lastName: "grant"
                    password: "test12345"
                    roleIds: ["${managerRole.id}"]
                }) { id }
            }
        `);

        const poMutation = () => gql`
            mutation {
                createPurchaseOrder(input: {
                    supplierId: "${createSupplier.id}"
                    targetLocationId: "${location.id}"
                    lines: [{ productVariantId: "${v.id}", quantity: 1, unitPrice: 100 }]
                }) { id state }
            }
        `;

        // 无 ManagePurchase → 被拒（staff 分支抛出即被拒；manager 分支可成功验证差异）
        await adminClient.asUserWithCredentials(emailDenied, 'test12345');
        const deniedError = await adminClient.query(poMutation()).catch((e: any) => e);
        expect(deniedError instanceof Error || deniedError?.message).toBeTruthy();

        // 有 ManagePurchase → 成功
        await adminClient.asUserWithCredentials(emailGranted, 'test12345');
        const ok = await adminClient.query(poMutation());
        expect(ok.createPurchaseOrder.state).toBe('Draft');
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);
});