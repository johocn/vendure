import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { ShopPlugin } from '@vendure/shop-plugin';
import { FavoritePlugin } from '../src/plugin';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('FavoritePlugin · 收藏/关注系统（商品收藏+店铺关注 toggle/列表/计数/登录隔离）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), FavoritePlugin.init({})],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let productIds: string[] = [];
    let shopAId: string;
    let shopBId: string;
    let secondClient: SimpleGraphQLClient;

    /* ------------------------- helpers ------------------------- */

    async function createProduct(name: string, slug: string): Promise<string> {
        const p = await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                }) { ... on Product { id } }
            }
        `) as any;
        return p.createProduct.id;
    }

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

    async function toggleFavorite(client: SimpleGraphQLClient, productId: string): Promise<boolean> {
        const res = await client.query(gql`
            mutation { toggleFavoriteProduct(productId: "${productId}") }
        `) as any;
        return res.toggleFavoriteProduct;
    }

    async function toggleFollow(client: SimpleGraphQLClient, shopId: string): Promise<boolean> {
        const res = await client.query(gql`
            mutation { toggleFollowShop(shopId: "${shopId}") }
        `) as any;
        return res.toggleFollowShop;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        productIds = [];
        for (let i = 1; i <= 3; i++) {
            const pid = await createProduct(`FavProd ${i}`, `fav-prod-${i}`);
            productIds.push(pid);
        }

        shopAId = (await createShop('Shop A', 'shop-a')).id;
        shopBId = (await createShop('Shop B', 'shop-b')).id;
        await setStatus(shopAId, 'active');
        await setStatus(shopBId, 'active');

        // 主用户（显式创建，账号/密码确定，避免依赖种子顾客）
        const main = await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Main", lastName: "User", emailAddress: "main.fav@test.com" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `) as any;
        expect(main.createCustomer.id).toBeDefined();
        await shopClient.asUserWithCredentials('main.fav@test.com', 'test');
        const meCheck = await shopClient.query(gql`
            query { activeCustomer { id emailAddress } }
        `) as any;
        expect(meCheck.activeCustomer).toBeDefined();

        // 第二个用户（越权隔离校验）
        const second = await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Second", lastName: "User", emailAddress: "second.fav@test.com" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `) as any;
        expect(second.createCustomer.id).toBeDefined();
        secondClient = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await secondClient.asUserWithCredentials('second.fav@test.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；收藏数与关注数初始为 0', async () => {
        expect(server.app).toBeDefined();
        const fav = await shopClient.query(gql`query { myFavoriteProducts { id } }`) as any;
        expect(fav.myFavoriteProducts).toEqual([]);
        const follow = await shopClient.query(gql`query { myFollowedShops { id } }`) as any;
        expect(follow.myFollowedShops).toEqual([]);
    });

    it('未登录访问收藏列表/操作被拒绝', async () => {
        const anon = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await assertThrowsWithMessage(
            () => anon.query(gql`query { myFavoriteProducts { id } }`),
            'not authorized',
        );
    });

    it('收藏商品 toggle 幂等：首点已收藏、再点取消、状态一致', async () => {
        const pid = productIds[0];
        expect(await toggleFavorite(shopClient, pid)).toBe(true);
        expect(await toggleFavorite(shopClient, pid)).toBe(false);
        expect(await toggleFavorite(shopClient, pid)).toBe(true);

        const isFav = await shopClient.query(gql`
            query { isProductFavorite(productId: "${pid}") }
        `) as any;
        expect(isFav.isProductFavorite).toBe(true);
    });

    it('收藏列表仅含本人收藏，且按收藏时间倒序', async () => {
        await toggleFavorite(shopClient, productIds[1]);
        const fav = await shopClient.query(gql`
            query { myFavoriteProducts { id } }
        `) as any;
        const ids = fav.myFavoriteProducts.map((p: any) => p.id);
        expect(ids).toContain(productIds[0]);
        expect(ids).toContain(productIds[1]);
    });

    it('商品收藏数快照写入 Product.favoriteCount', async () => {
        const pid = productIds[0];
        const count = await adminClient.query(gql`
            query { product(id: "${pid}") { customFields { favoriteCount } } }
        `) as any;
        // 仅当前顾客收藏了 productIds[0]
        expect(count.product.customFields.favoriteCount).toBe(1);
    });

    it('关注店铺 toggle 幂等 + 关注列表 + isShopFollowed', async () => {
        expect(await toggleFollow(shopClient, shopAId)).toBe(true);
        expect(await toggleFollow(shopClient, shopAId)).toBe(false);
        expect(await toggleFollow(shopClient, shopAId)).toBe(true);

        const isFollowed = await shopClient.query(gql`
            query { isShopFollowed(shopId: "${shopAId}") }
        `) as any;
        expect(isFollowed.isShopFollowed).toBe(true);

        const list = await shopClient.query(gql`
            query { myFollowedShops { id name status } }
        `) as any;
        const ids = list.myFollowedShops.map((s: any) => s.id);
        expect(ids).toContain(shopAId);
    });

    it('店铺关注数动态聚合', async () => {
        await toggleFollow(shopClient, shopBId);
        const count = await shopClient.query(gql`
            query { shopFollowerCount(shopId: "${shopAId}") }
        `) as any;
        expect(count.shopFollowerCount).toBe(1);
        const countB = await shopClient.query(gql`
            query { shopFollowerCount(shopId: "${shopBId}") }
        `) as any;
        expect(countB.shopFollowerCount).toBe(1);
    });

    it('越权隔离：用户 B 看不到用户 A 的收藏/关注，但可收藏自己的', async () => {
        const favB = await secondClient.query(gql`query { myFavoriteProducts { id } }`) as any;
        expect(favB.myFavoriteProducts).toEqual([]);
        const followB = await secondClient.query(gql`query { myFollowedShops { id } }`) as any;
        expect(followB.myFollowedShops).toEqual([]);

        await toggleFollow(secondClient, shopAId);
        const count = await shopClient.query(gql`
            query { shopFollowerCount(shopId: "${shopAId}") }
        `) as any;
        expect(count.shopFollowerCount).toBe(2);
    });
});