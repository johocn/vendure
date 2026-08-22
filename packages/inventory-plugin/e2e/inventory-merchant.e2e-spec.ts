import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

// 本插件未注册进 node_modules（新包），从其源码导入；shop-plugin 经 @vendure 别名（构建 lib 已有）。
import { InventoryPlugin } from '../src/inventory.plugin';
import { ShopPlugin } from '@vendure/shop-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('InventoryPlugin · 阶段47 店主自营库存（只读水位 + 归属校准）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), InventoryPlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let productAId: string;
    let variantAId: string;
    let productBId: string;
    let variantBId: string;
    let defaultLocationId: string;

    const MYSTOCK = gql`
        query ($pid: ID!) { myShopStock(productId: $pid) { variantId variantName sku locations { locationId locationName stockOnHand stockAllocated stockAvailable } } }
    `;
    const MYADJUST = gql`
        mutation ($vid: ID!, $lid: ID!, $onh: Int!) { myShopStockAdjust(variantId: $vid, stockLocationId: $lid, stockOnHand: $onh) }
    `;
    const LEDGER = gql`
        query ($vid: ID!, $biz: String) { stockLedger(productVariantId: $vid, bizType: $biz) { items { id bizType bizCode quantity beforeOnHand afterOnHand reason } totalItems } }
    `;

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test" }) { id } }
        `)) as any;
        await adminClient.query(gql`mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }`);
        return res.createShop.id;
    }

    async function provisionOwner(shopId: string, email: string): Promise<void> {
        await adminClient.query(gql`
            mutation { provisionShopOwner(shopId: "${shopId}", input: { emailAddress: "${email}", password: "test", firstName: "店", lastName: "主" }) { id } }
        `);
    }

    async function createVariantProduct(name: string, slug: string, taxCategoryId: string): Promise<{ id: string; variantId: string }> {
        const p = (await adminClient.query(gql`
            mutation { createProduct(input: { translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${slug} desc" }] }) { ... on Product { id } } }
        `)) as any;
        const pid = p.createProduct.id;
        const v = (await adminClient.query(gql`
            mutation { createProductVariants(input: [{ productId: "${pid}", sku: "${slug}-x", price: 100, taxCategoryId: "${taxCategoryId}", trackInventory: TRUE, translations: [{ languageCode: en, name: "${name} variant" }] }]) { ... on ProductVariant { id } } }
        `)) as any;
        return { id: pid, variantId: v.createProductVariants[0].id };
    }

    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 0,
        });
        await adminClient.asSuperAdmin();

        shopAId = await createShop('Shop A', 'shop-a');
        shopBId = await createShop('Shop B', 'shop-b');
        await provisionOwner(shopAId, 'ownerA.stock@test.com');
        await provisionOwner(shopBId, 'ownerB.stock@test.com');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createVariantProduct('A店商品', 'shop-a-stock', taxCategoryId);
        const pb = await createVariantProduct('B店商品', 'shop-b-stock', taxCategoryId);
        productAId = pa.id;
        variantAId = pa.variantId;
        productBId = pb.id;
        variantBId = pb.variantId;

        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopAId}", productIds: ["${productAId}"] }) }`);
        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopBId}", productIds: ["${productBId}"] }) }`);

        const locs = (await adminClient.query(gql`query { stockLocations { items { id name } } }`)) as any;
        defaultLocationId = locs.stockLocations.items[0].id;

        // 给 A 店商品所在位置设初始库存 50，给 B 店商品设 5（保证 stockLevels 存在行，供归属隔离断言基线）
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variantAId}", stockLocationId: "${defaultLocationId}", stockOnHand: 50) }
        `);
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variantBId}", stockLocationId: "${defaultLocationId}", stockOnHand: 5) }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('2 平台管理员（无 manageOwnShop 权限）调店主库存被拒', async () => {
        // 超管绕过 @Allow；另建一个仅持平台权限、无 manageOwnShop 的管理员验证拒绝
        const role = (await adminClient.query(gql`
            mutation { createRole(input: { code: "platform-staff", description: "platform", permissions: [UpdateSettings] }) { ... on Role { id } } }
        `)) as any;
        await adminClient.query(gql`
            mutation { createAdministrator(input: { firstName: "P", lastName: "A", emailAddress: "platform.staff@test.com", password: "test", roleIds: ["${role.createRole.id}"] }) { id } }
        `);
        const platformClient = await asOwner('platform.staff@test.com');
        await expect(platformClient.query(MYSTOCK, { pid: productAId })).rejects.toThrow();
        await expect(platformClient.query(MYADJUST, { vid: variantAId, lid: defaultLocationId, onh: 99 })).rejects.toThrow();
    });

    it('3 店主A只读水位：myShopStock 返回本人商品逐仓水位且不含他人商品', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        const r = (await ownerA.query(MYSTOCK, { pid: productAId })) as any;
        expect(r.myShopStock.length).toBeGreaterThan(0);
        const row = r.myShopStock.find((x: any) => String(x.variantId) === String(variantAId));
        expect(row).toBeDefined();
        const loc = row.locations.find((l: any) => String(l.locationId) === String(defaultLocationId));
        expect(loc).toBeDefined();
        expect(loc.stockOnHand).toBe(50);
    });

    it('4 店主A调整库存：写 manual 账本 + 水位变化', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        await ownerA.query(MYADJUST, { vid: variantAId, lid: defaultLocationId, onh: 80 });

        const r = (await ownerA.query(MYSTOCK, { pid: productAId })) as any;
        const row = r.myShopStock.find((x: any) => String(x.variantId) === String(variantAId));
        const loc = row.locations.find((l: any) => String(l.locationId) === String(defaultLocationId));
        expect(loc.stockOnHand).toBe(80);
        expect(loc.stockAvailable).toBe(80);

        // manual 账本留痕（bizCode=MyShop-shop-a）
        const ledger = (await adminClient.query(LEDGER, { vid: variantAId, biz: 'manual' })) as any;
        expect(ledger.stockLedger.totalItems).toBeGreaterThanOrEqual(1);
        expect(ledger.stockLedger.items.some((e: any) => String(e.bizCode) === 'MyShop-shop-a')).toBe(true);
    });

    it('5 归属隔离：店主A读/调他人店铺商品被拒', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        // 读 B 店商品
        await expect(ownerA.query(MYSTOCK, { pid: productBId })).rejects.toThrow();
        // 调 B 店变体
        await expect(ownerA.query(MYADJUST, { vid: variantBId, lid: defaultLocationId, onh: 10 })).rejects.toThrow();
        // 且 B 店库存未被改动
        const level = (await adminClient.query(gql`
            query { stockLevels(locationId: "${defaultLocationId}") { items { productVariantId stockOnHand } totalItems } }
        `)) as any;
        const row = level.stockLevels.items.find((x: any) => String(x.productVariantId) === String(variantBId));
        expect(row).toBeDefined();
        expect(row.stockOnHand).toBe(5);
    });
});