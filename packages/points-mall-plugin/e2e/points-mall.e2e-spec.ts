import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { MemberLevelPlugin } from '@vendure/member-level-plugin';
import { PointsMallPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('PointsMallPlugin · 积分商城（收藏/积分商品/兑换/支付/履约）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init(), PointsMallPlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let productId: string;
    let variantId: string;
    let customerId: string;
    let addressId: string;
    // 各用例创建/使用的积分商品 id
    let virtualProductId: string; // 纯积分虚拟（用例 3）
    let physicalProductId: string; // 纯积分实物（用例 4/5）
    let mixOrderId: string; // 混合价订单（用例 8 下单 → 9 结算 → 10 履约）

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        productId = products.products.items[0].id;
        variantId = products.products.items[0].variants[0].id;

        const me = await shopClient.query(gql`
            query { activeCustomer { id emailAddress } }
        `) as any;
        customerId = me.activeCustomer.id;

        // 预置积分（admin adjustPoints，同 member-level e2e 口径）
        await adminClient.query(gql`
            mutation { adjustPoints(customerId: "${customerId}", amount: 100000, remark: "seed") { points } }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- helpers ------------------------- */

    async function myPoints(): Promise<number> {
        const res = await shopClient.query(gql`
            query { myMemberInfo { points } }
        `) as any;
        return res.myMemberInfo.points;
    }

    async function adjustPointsBy(amount: number): Promise<void> {
        await adminClient.query(gql`
            mutation { adjustPoints(customerId: "${customerId}", amount: ${amount}, remark: "e2e") { points } }
        `);
    }

    async function createPointsProduct(input: {
        pointsPrice: number;
        deliveryType: string;
        stock: number;
        cashPrice?: number;
        perUserLimit?: number;
    }): Promise<any> {
        const res = await adminClient.query(gql`
            mutation {
                createPointsProduct(input: {
                    productId: "${productId}"
                    variantId: "${variantId}"
                    pointsPrice: ${input.pointsPrice}
                    cashPrice: ${input.cashPrice ?? 0}
                    deliveryType: "${input.deliveryType}"
                    stock: ${input.stock}
                    perUserLimit: ${input.perUserLimit ?? 0}
                }) {
                    id productId variantId pointsPrice cashPrice deliveryType stock perUserLimit redeemedCount status
                }
            }
        `) as any;
        return res.createPointsProduct;
    }

    async function adminPointsProduct(id: string): Promise<any> {
        const res = await adminClient.query(gql`
            query { pointsProductsAdmin { items { id stock redeemedCount status pointsPrice } totalItems } }
        `) as any;
        return res.pointsProductsAdmin.items.find((i: any) => i.id === id);
    }

    async function myPointsOrdersTotal(): Promise<number> {
        const res = await shopClient.query(gql`
            query { myPointsOrders { totalItems } }
        `) as any;
        return res.myPointsOrders.totalItems;
    }

    async function exchange(
        pointsProductId: string,
        quantity: number,
        withAddress = true,
    ): Promise<any> {
        const res = await shopClient.query(gql`
            mutation {
                createPointsOrderExchange(input: {
                    pointsProductId: "${pointsProductId}"
                    quantity: ${quantity}
                    ${withAddress ? `addressId: "${addressId}"` : ''}
                }) {
                    id code status pointsTotal cashTotal deliveryType quantity paidAt completedAt trackingNo
                    productSnapshot { productId name }
                    addressSnapshot { name phone detail }
                }
            }
        `) as any;
        return res.createPointsOrderExchange;
    }

    /* ------------------------- 用例 ------------------------- */

    it('toggle 收藏：重复切换 favorited 翻转，favoriteMeta/myFavorites 视图组装正确', async () => {
        const first = await shopClient.query(gql`
            mutation { toggleProductFavorite(productId: "${productId}") { favorited favoriteCount } }
        `) as any;
        expect(first.toggleProductFavorite.favorited).toBe(true);
        expect(first.toggleProductFavorite.favoriteCount).toBe(1);

        const meta = await shopClient.query(gql`
            query { productFavoriteMeta(productId: "${productId}") { favoriteCount myFavorited } }
        `) as any;
        expect(meta.productFavoriteMeta.favoriteCount).toBe(1);
        expect(meta.productFavoriteMeta.myFavorited).toBe(true);

        const second = await shopClient.query(gql`
            mutation { toggleProductFavorite(productId: "${productId}") { favorited favoriteCount } }
        `) as any;
        expect(second.toggleProductFavorite.favorited).toBe(false);
        expect(second.toggleProductFavorite.favoriteCount).toBe(0);

        const empty = await shopClient.query(gql`
            query { myFavorites { items { productId } totalItems } }
        `) as any;
        expect(empty.myFavorites.totalItems).toBe(0);
        expect(empty.myFavorites.items).toEqual([]);

        // 再收藏一次，验证收藏视图组装
        const third = await shopClient.query(gql`
            mutation { toggleProductFavorite(productId: "${productId}") { favorited favoriteCount } }
        `) as any;
        expect(third.toggleProductFavorite.favorited).toBe(true);

        const favs = await shopClient.query(gql`
            query { myFavorites { items { productId name slug image priceWithTax isOnSale pointsPrice favoritedAt } totalItems } }
        `) as any;
        expect(favs.myFavorites.totalItems).toBe(1);
        const view = favs.myFavorites.items[0];
        // e2e 环境 ID 经策略编码，回传一致即可，不硬编码
        expect(view.productId).toBe(productId);
        expect(view.name).toBe('Laptop');
        expect(typeof view.priceWithTax).toBe('number');
        expect(view.priceWithTax).toBeGreaterThan(0);
        expect(view.isOnSale).toBe(true);
        expect(view.favoritedAt).toBeTruthy();

        const metaAfter = await shopClient.query(gql`
            query { productFavoriteMeta(productId: "${productId}") { favoriteCount myFavorited } }
        `) as any;
        expect(metaAfter.productFavoriteMeta).toEqual({ favoriteCount: 1, myFavorited: true });
    });

    it('admin 建积分商品：variant 不属于 product 报错；正常建后 shop 列表可见', async () => {
        await expect(adminClient.query(gql`
            mutation {
                createPointsProduct(input: {
                    productId: "999"
                    variantId: "${variantId}"
                    pointsPrice: 1
                    deliveryType: "physical"
                    stock: 1
                }) { id }
            }
        `)).rejects.toThrow('Variant does not belong to product');

        const created = await createPointsProduct({
            pointsPrice: 1000,
            deliveryType: 'virtual',
            stock: 10,
            perUserLimit: 2,
        });
        expect(created.id).toBeTruthy();
        expect(created.status).toBe('enabled');
        expect(created.stock).toBe(10);
        expect(created.redeemedCount).toBe(0);
        virtualProductId = created.id;

        const adminList = await adminClient.query(gql`
            query { pointsProductsAdmin { items { id pointsPrice deliveryType status } totalItems } }
        `) as any;
        expect(adminList.pointsProductsAdmin.totalItems).toBe(1);
        expect(adminList.pointsProductsAdmin.items[0].id).toBe(virtualProductId);

        const shopList = await shopClient.query(gql`
            query { pointsProducts { items { id pointsPrice cashPrice deliveryType stock inStock name } totalItems } }
        `) as any;
        expect(shopList.pointsProducts.totalItems).toBe(1);
        const shopItem = shopList.pointsProducts.items[0];
        expect(shopItem.id).toBe(virtualProductId);
        expect(shopItem.pointsPrice).toBe(1000);
        expect(shopItem.cashPrice).toBe(0);
        expect(shopItem.deliveryType).toBe('virtual');
        expect(shopItem.inStock).toBe(true);
        expect(shopItem.name).toBe('Laptop');
    });

    it('纯积分虚拟兑换：扣分即 completed，库存/redeemedCount 同步', async () => {
        const before = await myPoints();
        expect(before).toBe(100000);

        const order = await exchange(virtualProductId, 1, false);
        expect(order.status).toBe('completed');
        expect(order.pointsTotal).toBe(1000);
        expect(order.cashTotal).toBe(0);
        expect(order.deliveryType).toBe('virtual');
        expect(order.code).toMatch(/^PO-/);
        expect(order.paidAt).toBeTruthy();
        expect(order.completedAt).toBeTruthy();
        expect(order.productSnapshot.name).toBeTruthy();

        const after = await myPoints();
        expect(after).toBe(before - 1000);

        const pp = await adminPointsProduct(virtualProductId);
        expect(pp.stock).toBe(9);
        expect(pp.redeemedCount).toBe(1);
    });

    it('纯积分实物兑换：缺地址 ADDRESS_REQUIRED，带地址进入 pending_ship', async () => {
        const phys = await createPointsProduct({
            pointsPrice: 100,
            deliveryType: 'physical',
            stock: 5,
        });
        physicalProductId = phys.id;

        await expect(shopClient.query(gql`
            mutation {
                createPointsOrderExchange(input: { pointsProductId: "${physicalProductId}", quantity: 1 }) { id }
            }
        `)).rejects.toThrow('ADDRESS_REQUIRED');

        const addr = await shopClient.query(gql`
            mutation {
                createCustomerAddress(input: {
                    fullName: "测试收货人"
                    streetLine1: "幸福路 1 号"
                    city: "杭州"
                    province: "浙江"
                    postalCode: "310000"
                    countryCode: "GB"
                    phoneNumber: "13800000000"
                }) { id fullName }
            }
        `) as any;
        addressId = addr.createCustomerAddress.id;
        expect(addressId).toBeTruthy();

        const order = await exchange(physicalProductId, 1, true);
        expect(order.status).toBe('pending_ship');
        expect(order.pointsTotal).toBe(100);
        expect(order.paidAt).toBeNull();
        expect(order.addressSnapshot.name).toBe('测试收货人');
        expect(order.addressSnapshot.detail).toBe('幸福路 1 号');

        const pp = await adminPointsProduct(physicalProductId);
        expect(pp.stock).toBe(4);
        expect(pp.redeemedCount).toBe(1);
    });

    it('积分不足：spendPoints 报错且不建单不扣库存', async () => {
        const before = await myPoints(); // 100000 - 1000 - 100 = 98900
        // 清到 50 分，低于实物商品单价 100
        await adjustPointsBy(50 - before);
        expect(await myPoints()).toBe(50);

        const ordersBefore = await myPointsOrdersTotal();
        await expect(shopClient.query(gql`
            mutation {
                createPointsOrderExchange(input: {
                    pointsProductId: "${physicalProductId}"
                    quantity: 1
                    addressId: "${addressId}"
                }) { id }
            }
        `)).rejects.toThrow('Insufficient points');

        // 不建单
        expect(await myPointsOrdersTotal()).toBe(ordersBefore);
        // 不扣库存
        const pp = await adminPointsProduct(physicalProductId);
        expect(pp.stock).toBe(4);
        expect(pp.redeemedCount).toBe(1);
    });

    it('库存不足：OUT_OF_STOCK，原子扣减不超卖', async () => {
        const lowStock = await createPointsProduct({
            pointsPrice: 10,
            deliveryType: 'virtual',
            stock: 1,
        });
        await expect(shopClient.query(gql`
            mutation {
                createPointsOrderExchange(input: { pointsProductId: "${lowStock.id}", quantity: 2 }) { id }
            }
        `)).rejects.toThrow('OUT_OF_STOCK');

        // 库存未被破坏
        const pp = await adminPointsProduct(lowStock.id);
        expect(pp.stock).toBe(1);
        expect(pp.redeemedCount).toBe(0);
    });

    it('超个人限购：PER_USER_LIMIT_EXCEEDED', async () => {
        // 用例 5 清分后充值，供限购兑换扣分
        await adjustPointsBy(10000);
        const limited = await createPointsProduct({
            pointsPrice: 10,
            deliveryType: 'virtual',
            stock: 10,
            perUserLimit: 2,
        });

        const o1 = await exchange(limited.id, 1, false);
        expect(o1.status).toBe('completed');
        const o2 = await exchange(limited.id, 1, false);
        expect(o2.status).toBe('completed');

        // used=2（cancelled 才不计入），第 3 件超限
        await expect(shopClient.query(gql`
            mutation {
                createPointsOrderExchange(input: { pointsProductId: "${limited.id}", quantity: 1 }) { id }
            }
        `)).rejects.toThrow('PER_USER_LIMIT_EXCEEDED');
    });

    it('混合价取消：退积分+回补库存+支付单 cancelled，复购无库存泄漏', async () => {
        const before = await myPoints();
        const mix = await createPointsProduct({
            pointsPrice: 500,
            cashPrice: 990,
            deliveryType: 'physical',
            stock: 5,
        });

        // 下单：已扣分 + 建支付单，等现金支付
        const order = await exchange(mix.id, 1, true);
        expect(order.status).toBe('pending_payment');
        expect(order.pointsTotal).toBe(500);
        expect(order.cashTotal).toBe(990);
        expect(await myPoints()).toBe(before - 500);

        let pp = await adminPointsProduct(mix.id);
        expect(pp.stock).toBe(4);
        expect(pp.redeemedCount).toBe(1);

        // 取消：状态置 cancelled + 积分回增 + 库存回补
        const cancelled = await shopClient.query(gql`
            mutation { cancelPointsOrder(id: "${order.id}") { id code status } }
        `) as any;
        expect(cancelled.cancelPointsOrder.status).toBe('cancelled');
        expect(await myPoints()).toBe(before);

        // EARN 流水（cancel refund）
        const history = await shopClient.query(gql`
            query { myPointsHistory(options: { take: 100 }) { items { type amount remark } } }
        `) as any;
        const refund = history.myPointsHistory.items.find(
            (h: any) => (h.remark ?? '').includes('cancel refund') && h.amount === 500,
        );
        expect(refund).toBeTruthy();

        // 库存回补
        pp = await adminPointsProduct(mix.id);
        expect(pp.stock).toBe(5);
        expect(pp.redeemedCount).toBe(0);

        // 再次下单成功（库存未泄漏），留给后续结算/履约用例
        const order2 = await exchange(mix.id, 1, true);
        expect(order2.status).toBe('pending_payment');
        mixOrderId = order2.id;
        pp = await adminPointsProduct(mix.id);
        expect(pp.stock).toBe(4);
    });

    it('混合价结算：myPointsOrders 过滤 pending_payment；markPointsOrderPaid 兜底置为已付', async () => {
        const pending = await shopClient.query(gql`
            query { myPointsOrders(options: { status: "pending_payment" }) { items { id status } totalItems } }
        `) as any;
        expect(pending.myPointsOrders.totalItems).toBe(1);
        expect(pending.myPointsOrders.items[0].id).toBe(mixOrderId);

        // 线下收款兜底：paid → 实物单进 pending_ship
        const paid = await adminClient.query(gql`
            mutation { markPointsOrderPaid(id: "${mixOrderId}") { id status paidAt trackingNo } }
        `) as any;
        expect(paid.markPointsOrderPaid.status).toBe('pending_ship');
        expect(paid.markPointsOrderPaid.paidAt).toBeTruthy();

        // 重复结算报非法流转
        await expect(adminClient.query(gql`
            mutation { markPointsOrderPaid(id: "${mixOrderId}") { id status } }
        `)).rejects.toThrow('Points order is pending_ship');
    });

    it('admin 履约：paid/shipped/completed 状态机与非法流转报错', async () => {
        const shipped = await adminClient.query(gql`
            mutation { markPointsOrderShipped(id: "${mixOrderId}", trackingNo: "SF123") { id status trackingNo shippedAt } }
        `) as any;
        expect(shipped.markPointsOrderShipped.status).toBe('shipped');
        expect(shipped.markPointsOrderShipped.trackingNo).toBe('SF123');
        expect(shipped.markPointsOrderShipped.shippedAt).toBeTruthy();

        const completed = await adminClient.query(gql`
            mutation { markPointsOrderCompleted(id: "${mixOrderId}") { id status completedAt } }
        `) as any;
        expect(completed.markPointsOrderCompleted.status).toBe('completed');
        expect(completed.markPointsOrderCompleted.completedAt).toBeTruthy();

        await expect(adminClient.query(gql`
            mutation { markPointsOrderCompleted(id: "${mixOrderId}") { id status } }
        `)).rejects.toThrow('Points order is completed');
    });
});
