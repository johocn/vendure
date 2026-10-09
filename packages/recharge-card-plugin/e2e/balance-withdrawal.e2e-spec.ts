import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { RechargeCardPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('RechargeCardPlugin · 余额提现三态机', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [RechargeCardPlugin.init()],
        }),
    );

    const EMAIL = 'withdraw.balance@test.com';
    let customerId: string;
    let firstWithdrawalId: string;

    // admin 显式 createCustomer + 设密码后登录（与 recharge-card.e2e-spec 同款模式，保证凭据可控）
    async function createCustomerAndLogin(email: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "W", lastName: "D", emailAddress: "${email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `)) as any;
        await shopClient.asUserWithCredentials(email, 'test');
        return res.createCustomer.id;
    }

    async function fetchFrozenBalance(): Promise<{ balance: number; frozenBalance: number }> {
        const r = (await shopClient.query(gql`
            query { myBalanceWithFrozen { balance frozenBalance } }
        `)) as any;
        return r.myBalanceWithFrozen;
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
        });
        await adminClient.asSuperAdmin();
        customerId = await createCustomerAndLogin(EMAIL);

        // admin 手工入账 10000 分作为种子余额
        const seed = await adminClient.query(gql`
            mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: 10000, type: "adjust", remark: "seed" }) { balance } }
        `);
        expect((seed as any).adminAdjustBalance.balance).toBe(10000);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('plugin loads without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('申请提现：balance 原子冻结入 frozenBalance + FREEZE 流水 + pending 单', async () => {
        const r = (await shopClient.query(gql`
            mutation { requestBalanceWithdrawal(amount: 2000, method: "wechat", accountInfo: "test@example.com") { id amount method accountInfo status } }
        `)) as any;
        const wd = r.requestBalanceWithdrawal;
        expect(wd.status).toBe('pending');
        expect(wd.amount).toBe(2000);
        expect(wd.method).toBe('wechat');
        firstWithdrawalId = wd.id;

        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 2000 });

        const list = (await shopClient.query(gql`
            query { myBalanceWithdrawals(options: {}) { totalItems items { id status amount } } }
        `)) as any;
        expect(list.myBalanceWithdrawals.totalItems).toBe(1);
        expect(list.myBalanceWithdrawals.items[0].status).toBe('pending');

        const tx = (await shopClient.query(gql`
            query { myBalanceTransactions(options: { take: 10 }) { items { type amount balanceBefore balanceAfter } } }
        `)) as any;
        const freeze = tx.myBalanceTransactions.items.find((t: any) => t.type === 'freeze');
        expect(freeze).toBeDefined();
        expect(freeze.amount).toBe(-2000);
        expect(freeze.balanceAfter).toBe(8000);
    });

    it('驳回：解冻回补 balance + UNFREEZE 流水；重复驳回被拒且不重复回补', async () => {
        const r = (await adminClient.query(gql`
            mutation { rejectBalanceWithdrawal(id: "${firstWithdrawalId}", remark: "账号有误") { id status remark reviewedAt } }
        `)) as any;
        expect(r.rejectBalanceWithdrawal.status).toBe('rejected');
        expect(r.rejectBalanceWithdrawal.remark).toBe('账号有误');
        expect(r.rejectBalanceWithdrawal.reviewedAt).toBeTruthy();

        expect(await fetchFrozenBalance()).toEqual({ balance: 10000, frozenBalance: 0 });

        const tx = (await shopClient.query(gql`
            query { myBalanceTransactions(options: { take: 10 }) { items { type amount balanceBefore balanceAfter } } }
        `)) as any;
        const unfreeze = tx.myBalanceTransactions.items.find((t: any) => t.type === 'unfreeze');
        expect(unfreeze).toBeDefined();
        expect(unfreeze.amount).toBe(2000);
        expect(unfreeze.balanceAfter).toBe(10000);

        // 重复流转：已 rejected 再 reject 抛错（transition 带原状态条件防重）
        await expect(adminClient.query(gql`
            mutation { rejectBalanceWithdrawal(id: "${firstWithdrawalId}") { id status } }
        `)).rejects.toThrow(/cannot be marked as/);
        // 余额未被二次回补
        expect(await fetchFrozenBalance()).toEqual({ balance: 10000, frozenBalance: 0 });
    });

    it('approve 冻结态 → markPaid 扣实：frozenBalance 清零、balance 不变', async () => {
        const req = (await shopClient.query(gql`
            mutation { requestBalanceWithdrawal(amount: 2000, method: "alipay", accountInfo: "ali@example.com") { id status } }
        `)) as any;
        const id2 = req.requestBalanceWithdrawal.id;
        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 2000 });

        const approved = (await adminClient.query(gql`
            mutation { approveBalanceWithdrawal(id: "${id2}", remark: "ok") { id status reviewedAt } }
        `)) as any;
        expect(approved.approveBalanceWithdrawal.status).toBe('approved');
        expect(approved.approveBalanceWithdrawal.reviewedAt).toBeTruthy();
        // approved：冻结态维持
        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 2000 });

        const paid = (await adminClient.query(gql`
            mutation { markBalanceWithdrawalPaid(id: "${id2}") { id status paidAt } }
        `)) as any;
        expect(paid.markBalanceWithdrawalPaid.status).toBe('paid');
        expect(paid.markBalanceWithdrawalPaid.paidAt).toBeTruthy();
        // paid：冻结出账，可用余额不变
        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 0 });

        // paid 后不可再 reject / 不可重复 markPaid
        await expect(adminClient.query(gql`
            mutation { rejectBalanceWithdrawal(id: "${id2}") { id status } }
        `)).rejects.toThrow(/cannot be marked as/);
        await expect(adminClient.query(gql`
            mutation { markBalanceWithdrawalPaid(id: "${id2}") { id status } }
        `)).rejects.toThrow(/cannot be marked as/);
        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 0 });
    });

    it('余额不足 / 低于起提金额：拒绝且余额不变', async () => {
        await expect(shopClient.query(gql`
            mutation { requestBalanceWithdrawal(amount: 999999, method: "wechat", accountInfo: "x@example.com") { id status } }
        `)).rejects.toThrow(/Insufficient balance/);
        await expect(shopClient.query(gql`
            mutation { requestBalanceWithdrawal(amount: 500, method: "wechat", accountInfo: "x@example.com") { id status } }
        `)).rejects.toThrow(/Minimum withdrawal amount/);
        expect(await fetchFrozenBalance()).toEqual({ balance: 8000, frozenBalance: 0 });
    });

    it('admin balanceWithdrawals 列表可见全部申请', async () => {
        const all = (await adminClient.query(gql`
            query { balanceWithdrawals(options: {}) { totalItems items { id customerId amount method status } } }
        `)) as any;
        expect(all.balanceWithdrawals.totalItems).toBe(2);

        const rejectedOnly = (await adminClient.query(gql`
            query { balanceWithdrawals(options: { status: "rejected" }) { totalItems } }
        `)) as any;
        expect(rejectedOnly.balanceWithdrawals.totalItems).toBe(1);

        const paidOnly = (await adminClient.query(gql`
            query { balanceWithdrawals(options: { status: "paid" }) { totalItems } }
        `)) as any;
        expect(paidOnly.balanceWithdrawals.totalItems).toBe(1);
    });
});
