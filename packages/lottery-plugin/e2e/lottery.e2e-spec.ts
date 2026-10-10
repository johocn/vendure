import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { MemberLevelPlugin } from '@vendure/member-level-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { LotteryPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('LotteryPlugin · 九宫格积分抽奖（加权开奖/spendPoints 桥扣/库存/CRUD）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init({}), LotteryPlugin.init({})],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let customerId: string;
    let prizeA: any; // 一等奖 weight 1
    let prizeB: any; // 谢谢参与 weight 98
    let prizeC: any; // 二等奖 weight 1

    async function adjustPoints(amount: number): Promise<number> {
        const res = await adminClient.query(gql`
            mutation { adjustPoints(customerId: "${customerId}", amount: ${amount}) { points } }
        `) as any;
        return res.adjustPoints.points;
    }

    async function myMemberPoints(): Promise<number> {
        const res = await shopClient.query(gql`query { myMemberInfo { points } }`) as any;
        return res.myMemberInfo.points;
    }

    async function myLotteryPrizes(): Promise<any[]> {
        const res = await shopClient.query(gql`
            query { myLotteryPrizes { id name image consume } }
        `) as any;
        return res.myLotteryPrizes;
    }

    async function drawLottery(): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { drawLottery { prizeIndex prize { id name image consume } } }
        `) as any;
        return res.drawLottery;
    }

    async function myRecords(): Promise<any> {
        const res = await shopClient.query(gql`
            query { myLotteryRecords(options: { skip: 0, take: 10 }) { totalItems items { id customerId prizeId prizeName prizeImage consume createdAt } } }
        `) as any;
        return res.myLotteryRecords;
    }

    async function adminPrizes(): Promise<any> {
        const res = await adminClient.query(gql`
            query { lotteryPrizes(options: { skip: 0, take: 10 }) { totalItems items { id name image weight consume stock enabled sort } } }
        `) as any;
        return res.lotteryPrizes;
    }

    async function setPrizeEnabled(id: string, enabled: boolean): Promise<void> {
        await adminClient.query(gql`
            mutation { updateLotteryPrize(input: { id: "${id}", enabled: ${enabled} }) { id enabled } }
        `);
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`query { activeCustomer { id } }`) as any;
        customerId = me.activeCustomer.id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('admin CRUD：创建三档奖品 → 分页查询（sort/id 序）→ 更新 → 新建+删除', async () => {
        const c1 = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "一等奖", image: "https://cdn.test/prize-1.png", weight: 1, consume: 100, sort: 1 }) { id name image weight consume stock enabled sort } }
        `) as any;
        prizeA = c1.createLotteryPrize;
        expect(prizeA.weight).toBe(1);
        expect(prizeA.consume).toBe(100);
        expect(prizeA.enabled).toBe(true);
        expect(prizeA.stock).toBeNull();

        const c2 = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "谢谢参与", image: "https://cdn.test/prize-2.png", weight: 98, consume: 100, sort: 2 }) { id name weight consume } }
        `) as any;
        prizeB = c2.createLotteryPrize;
        const c3 = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "二等奖", image: "https://cdn.test/prize-3.png", weight: 1, consume: 100, sort: 3 }) { id name weight consume } }
        `) as any;
        prizeC = c3.createLotteryPrize;

        const list = await adminPrizes();
        expect(list.totalItems).toBe(3);
        expect(list.items.map((p: any) => p.name)).toEqual(['一等奖', '谢谢参与', '二等奖']);

        const up = await adminClient.query(gql`
            mutation { updateLotteryPrize(input: { id: "${prizeB.id}", weight: 50, enabled: false }) { id weight enabled } }
        `) as any;
        expect(up.updateLotteryPrize.weight).toBe(50);
        expect(up.updateLotteryPrize.enabled).toBe(false);
        await setPrizeEnabled(prizeB.id, true);

        const tmp = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "临时奖", weight: 0, consume: 0 }) { id } }
        `) as any;
        expect(tmp.createLotteryPrize.id).toBeTruthy();
        const del = await adminClient.query(gql`
            mutation { deleteLotteryPrize(id: "${tmp.createLotteryPrize.id}") }
        `) as any;
        expect(del.deleteLotteryPrize).toBe(true);
        expect((await adminPrizes()).totalItems).toBe(3);
    });

    it('开奖：drawLottery 服务端加权出奖、prizeIndex 落在奖品序列内、积分逐次扣减、记录落库', async () => {
        await adjustPoints(1000);
        expect(await myMemberPoints()).toBe(1000);

        const prizes = await myLotteryPrizes();
        expect(prizes.length).toBe(3);
        expect(prizes.every((p: any) => p.consume === 100)).toBe(true);

        for (let i = 1; i <= 3; i++) {
            const r = await drawLottery();
            expect(r.prizeIndex).toBeGreaterThanOrEqual(0);
            expect(r.prizeIndex).toBeLessThan(3);
            expect(r.prize.consume).toBe(100);
            // 积分扣减正确（每次消耗所中奖品的 consume）
            expect(await myMemberPoints()).toBe(1000 - 100 * i);
            // 记录落库且快照一致（id DESC，首条为最新）
            const records = await myRecords();
            expect(records.totalItems).toBe(i);
            expect(records.items[0].prizeId).toBe(r.prize.id);
            expect(records.items[0].prizeName).toBe(r.prize.name);
            expect(records.items[0].prizeImage).toBe(r.prize.image);
            expect(records.items[0].consume).toBe(100);
            expect(records.items[0].createdAt).toBeTruthy();
        }
        expect(await myMemberPoints()).toBe(700);
    });

    it('库存为 0 的奖品不参与开奖也不出现在 shop 奖品列表', async () => {
        const zero = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "库存0奖", weight: 1000000, consume: 100, stock: 0 }) { id } }
        `) as any;
        const zeroId = zero.createLotteryPrize.id;
        expect((await myLotteryPrizes()).some((p: any) => p.id === zeroId)).toBe(false);
        const r = await drawLottery();
        expect(r.prize.id).not.toBe(zeroId);
        expect(r.prizeIndex).toBeLessThan(3);
        await adminClient.query(gql`mutation { deleteLotteryPrize(id: "${zeroId}") }`);
        expect(await myMemberPoints()).toBe(600);
    });

    it('余额不足：drawLottery 报 Insufficient points 且记录不新增（事务回滚）', async () => {
        expect(await adjustPoints(-600)).toBe(0);
        const before = (await myRecords()).totalItems;
        await expect(drawLottery()).rejects.toThrow('Insufficient points');
        expect((await myRecords()).totalItems).toBe(before);
    });

    it('未配置（全部停用）：drawLottery 报 Lottery is not configured', async () => {
        const prizes = (await adminPrizes()).items as any[];
        for (const p of prizes) {
            await setPrizeEnabled(p.id, false);
        }
        const before = (await myRecords()).totalItems;
        await expect(drawLottery()).rejects.toThrow('Lottery is not configured');
        expect((await myRecords()).totalItems).toBe(before);
        // 恢复启用，保持数据一致
        for (const p of prizes) {
            await setPrizeEnabled(p.id, true);
        }
        expect((await myLotteryPrizes()).length).toBe(3);
    });

    it('启用奖品上限：满 8 后创建/启用第 9 个被拒；禁用一个后可再启用另一个', async () => {
        // 当前 3 个启用奖品（一等奖/谢谢参与/二等奖），补 5 个凑满 8
        const extra: string[] = [];
        for (let i = 1; i <= 5; i++) {
            const c = await adminClient.query(gql`
                mutation { createLotteryPrize(input: { name: "补位奖${i}", weight: 0, consume: 0 }) { id enabled } }
            `) as any;
            expect(c.createLotteryPrize.enabled).toBe(true);
            extra.push(c.createLotteryPrize.id);
        }
        expect((await myLotteryPrizes()).length).toBe(8);

        // 第 9 个（默认启用）创建被拒
        await expect(
            adminClient.query(gql`
                mutation { createLotteryPrize(input: { name: "第9奖", weight: 0, consume: 0 }) { id } }
            `),
        ).rejects.toThrow('Lottery enabled prize limit reached (max 8)');

        // 停用态创建成功，但再启用被拒
        const ninth = await adminClient.query(gql`
            mutation { createLotteryPrize(input: { name: "第9奖", weight: 0, consume: 0, enabled: false }) { id enabled } }
        `) as any;
        expect(ninth.createLotteryPrize.enabled).toBe(false);
        await expect(
            adminClient.query(gql`
                mutation { updateLotteryPrize(input: { id: "${ninth.createLotteryPrize.id}", enabled: true }) { id enabled } }
            `),
        ).rejects.toThrow('Lottery enabled prize limit reached (max 8)');

        // 禁用一个后可再启用另一个
        await setPrizeEnabled(extra[0], false);
        await setPrizeEnabled(ninth.createLotteryPrize.id, true);
        expect((await myLotteryPrizes()).length).toBe(8);

        // 清理：删除补位奖品与第 9 个，恢复初始 3 奖品状态
        for (const id of extra) {
            await adminClient.query(gql`mutation { deleteLotteryPrize(id: "${id}") }`);
        }
        await adminClient.query(gql`mutation { deleteLotteryPrize(id: "${ninth.createLotteryPrize.id}") }`);
        expect((await adminPrizes()).totalItems).toBe(3);
    });
});
