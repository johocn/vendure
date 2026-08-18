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
});