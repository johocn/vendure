import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import path from 'path';
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

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it.todo('toggle 收藏：重复切换 favorited 翻转，favoriteMeta/myFavorites 视图组装正确');
    it.todo('admin 建积分商品：variant 不属于 product 报错；正常建后 shop 列表可见');
    it.todo('纯积分虚拟兑换：扣分即 completed，库存/redeemedCount 同步');
    it.todo('纯积分实物兑换：缺地址 ADDRESS_REQUIRED，带地址进入 pending_ship');
    it.todo('积分不足：spendPoints 报错且不建单不扣库存');
    it.todo('库存不足：OUT_OF_STOCK，并发下原子扣减不超卖');
    it.todo('超个人限购：PER_USER_LIMIT_EXCEEDED（cancelled 不计入）');
    it.todo('混合价取消：退积分+回补库存+支付单 cancelled');
    it.todo('混合价结算：settlePointsOrderByOutTradeNo 重复回调幂等');
    it.todo('admin 履约：paid/shipped/completed 状态机与非法流转报错');
});
