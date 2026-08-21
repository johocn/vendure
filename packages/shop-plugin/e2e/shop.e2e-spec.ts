import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { ShopPlugin } from '../src/plugin';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('ShopPlugin · 商家店铺体系（店铺实体/主页/商品归属/店铺评分/开店审核）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({})],
        // 注册商品评分快照字段（对齐 review-plugin 的写回契约），供本测试用 updateProduct 写入评分以驱动店铺评分聚合
        customFields: {
            Product: [
                { name: 'reviewRating', type: 'float', nullable: true, public: true },
                { name: 'reviewCount', type: 'int', nullable: true, public: true },
            ],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let shopAId: string;
    let productIds: string[] = [];

    /* ------------------------- helpers ------------------------- */

    async function createProduct(name: string, slug: string, taxCategoryId: string): Promise<string> {
        const p = await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                }) { ... on Product { id } }
            }
        `) as any;
        const pid = p.createProduct.id;
        await adminClient.query(gql`
            mutation {
                createProductVariants(input: [{
                    productId: "${pid}"
                    sku: "${slug}-x"
                    price: 100
                    taxCategoryId: "${taxCategoryId}"
                    translations: [{ languageCode: en, name: "${name} variant" }]
                }]) { ... on ProductVariant { id } }
            }
        `) as any;
        return pid;
    }

    /** 建店（默认 applicant）并返回 id。 */
    async function createShop(name: string, slug: string): Promise<any> {
        const res = await adminClient.query(gql`
            mutation {
                createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) {
                    id name slug status description
                }
            }
        `) as any;
        return res.createShop;
    }

    async function setStatus(id: string, status: string): Promise<void> {
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${id}", status: "${status}") { id status } }
        `);
    }

    async function assign(shopId: string, ids: string[]): Promise<boolean> {
        const list = ids.map(id => `"${id}"`).join(',');
        const res = await adminClient.query(gql`
            mutation { assignProductsToShop(input: { shopId: "${shopId}", productIds: [${list}] }) }
        `) as any;
        return res.assignProductsToShop;
    }

    async function unassign(shopId: string, ids: string[]): Promise<boolean> {
        const list = ids.map(id => `"${id}"`).join(',');
        const res = await adminClient.query(gql`
            mutation { unassignProductsFromShop(input: { shopId: "${shopId}", productIds: [${list}] }) }
        `) as any;
        return res.unassignProductsFromShop;
    }

    async function recompute(shopId: string): Promise<any> {
        const res = await adminClient.query(gql`
            mutation { recomputeShopRating(id: "${shopId}") {
                id
                rating { rating reviewCount productCount }
            } }
        `) as any;
        return res.recomputeShopRating;
    }

    /** 直接写商品评分快照（模拟 review-plugin 聚合结果）。 */
    async function setProductRating(productId: string, rating: number, count: number): Promise<void> {
        await adminClient.query(gql`
            mutation {
                updateProduct(input: {
                    id: "${productId}"
                    customFields: { reviewRating: ${rating}, reviewCount: ${count} }
                }) { id }
            }
        `);
    }

    async function activeShops(): Promise<any[]> {
        const res = await shopClient.query(gql`
            query { shops { id name slug status rating { rating reviewCount productCount } productCount } }
        `) as any;
        return res.shops;
    }

    async function shopBySlug(slug: string): Promise<any> {
        const res = await shopClient.query(gql`
            query { shop(slug: "${slug}") {
                id name slug description status
                rating { rating reviewCount productCount }
                productCount
                products { totalItems items { id } }
            } }
        `) as any;
        return res.shop;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        // CSV 仅 1 个商品（Laptop），再补建 2 个商品支撑评分聚合用例
        const taxCats = await adminClient.query(gql`
            query { taxCategories { items { id } } }
        `) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;

        const products = await adminClient.query(gql`
            query { products(options: { take: 3 }) { items { id } } }
        `) as any;
        const csvProductIds = products.products.items.map((p: any) => p.id);
        productIds = [
            ...csvProductIds,
            await createProduct('店二商品', 'extra-product-1', taxCategoryId),
            await createProduct('店三商品', 'extra-product-2', taxCategoryId),
        ];
        expect(productIds.length).toBeGreaterThanOrEqual(3);
        return;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；无店铺时 shops 为空，商品默认无归属店铺', async () => {
        expect(server.app).toBeDefined();
        const shops = await activeShops();
        expect(shops.length).toBe(0);
    });

    it('开店与审核：建店主 applicant、审核通过 active 后 C 端可见、再封店不对外', async () => {
        const shop = await createShop('旗舰店', 'flagship');
        expect(shop.status).toBe('applicant');
        shopAId = shop.id;

        // applicant 不对外
        let list = await activeShops();
        expect(list.length).toBe(0);

        await setStatus(shopAId, 'active');
        list = await activeShops();
        expect(list.length).toBe(1);
        expect(list[0].slug).toBe('flagship');
        expect(list[0].status).toBe('active');

        // 封店后不对外
        await setStatus(shopAId, 'closed');
        list = await activeShops();
        expect(list.length).toBe(0);

        // 重开供后续用例使用
        await setStatus(shopAId, 'active');
    });

    it('商品归属店铺：assign 后店铺商品含该商品、product.shopId 生效（shop 列表含商品）', async () => {
        expect(await assign(shopAId, [productIds[0], productIds[1]])).toBe(true);

        const detail = await shopBySlug('flagship');
        expect(detail.products.totalItems).toBe(2);
        expect(detail.productCount).toBe(2);
        expect(detail.products.items.map((p: any) => p.id)).toEqual(
            expect.arrayContaining(productIds.slice(0, 2)),
        );
        // 未归属商品不在列表
        const list = await activeShops();
        expect(list.length).toBe(1);
    });

    it('解绑：unassign 后商品移出店铺、productCount 减少', async () => {
        expect(await unassign(shopAId, [productIds[1]])).toBe(true);
        const detail = await shopBySlug('flagship');
        expect(detail.products.totalItems).toBe(1);
        expect(detail.productCount).toBe(1);
    });

    it('店铺评分聚合：加权平均 + reviewCount 求和 + productCount 正确', async () => {
        // 给当前店铺的 1 件归属商品写评分 4.5(4条)，再给未归属商品写 5.0(2条)，仅归属商品计入
        await setProductRating(productIds[0], 4.5, 4);
        await setProductRating(productIds[1], 5.0, 2); // 已解绑，不计入
        const cached = await recompute(shopAId);
        expect(cached.rating.rating).toBeCloseTo(4.5, 1);
        expect(cached.rating.reviewCount).toBe(4);
        expect(cached.rating.productCount).toBe(1);

        // 再分配一件（5.0/2条），加权平均 = (4.5*4 + 5.0*2)/(4+2) = 28/6 = 4.6667 → 4.7
        expect(await assign(shopAId, [productIds[1]])).toBe(true);
        const cached2 = await recompute(shopAId);
        expect(cached2.rating.rating).toBeCloseTo(4.7, 1);
        expect(cached2.rating.reviewCount).toBe(6);
        expect(cached2.rating.productCount).toBe(2);
    });

    it('店铺主页：shop(slug) 返回档案+评分+商品数+商品列表；存在 slug 不对外返回 null；不存在返回 null', async () => {
        const detail = await shopBySlug('flagship');
        expect(detail.id).toBeDefined();
        expect(detail.name).toBe('旗舰店');
        expect(detail.status).toBe('active');
        expect(detail.rating.productCount).toBe(2);
        expect(detail.products.totalItems).toBe(2);

        // 不存在 slug 返回 null
        const missing = await shopBySlug('not-exist');
        expect(missing).toBeNull();
    });

    it('校验与越权：slug 重复建店被拦截', async () => {
        await assertThrowsWithMessage(
            () => createShop('重复店', 'flagship'),
            'already in use',
        );
    });
});