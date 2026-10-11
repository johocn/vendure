import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { DiyPlugin } from '../src/diy-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('DiyPlugin · DIY 商品（素材合并/方案/报价/下单/回补）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [DiyPlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let mainId = '';
    let spacerId = '';
    let planId = '';
    let planB = '';
    let planC = '';

    const params155 = { wristSize: 155, fit: 'comfortable', gap: 0.5 };

    /**
     * e2e 环境适配：TestingEntityIdStrategy 把 GraphQL ID 编码为 "T_<n>"。
     * ID 类型入参由服务端 IdInterceptor 自动解码；但写入 Int 列/JSON（categoryId、spec.materialId）
     * 及与 Int customField（orderLine customFields.diyPlanId）比较前须还原数字（同 installment-plugin e2e）。
     */
    function numericId(id: string): number {
        return Number(String(id).replace('T_', ''));
    }

    /* ------------------------- helpers ------------------------- */

    async function adminStock(materialId: string): Promise<number> {
        const res = await adminClient.query(gql`
            query { diyMaterial(id: "${materialId}") { stock } }
        `) as any;
        return res.diyMaterial.stock as number;
    }

    async function shopPlan(id: string): Promise<any> {
        const res = await shopClient.query(gql`
            query { myDiyPlan(id: "${id}") { id status quoteNo orderLineId } }
        `) as any;
        return res.myDiyPlan;
    }

    async function createPlan(spec: object): Promise<any> {
        // JSON.stringify 生成的对象键带引号，不能内联为 GraphQL 对象字面量，改用 variables 传 JSON
        const res = await shopClient.query(
            gql`
                mutation ($templateCode: String!, $spec: JSON!) {
                    createDiyPlan(templateCode: $templateCode, spec: $spec) { id status bom quoteNo expiresAt calcVersion }
                }
            `,
            { templateCode: 'bracelet-classic', spec },
        ) as any;
        return res.createDiyPlan;
    }

    async function adminFindOrderWithPlan(planIds: string[]): Promise<any> {
        const numericPlanIds = planIds.map(numericId);
        const res = await adminClient.query(gql`
            query {
                orders(options: { take: 20 }) {
                    items {
                        id
                        state
                        totalWithTax
                        lines {
                            id
                            quantity
                            linePriceWithTax
                            customFields {
                                diyPlanId
                                diyUnitPrice
                                diyBom
                                diyQuoteRefAmount
                            }
                        }
                    }
                }
            }
        `) as any;
        return res.orders.items.find((o: any) =>
            o.lines.some((l: any) => numericPlanIds.includes(Number(l.customFields?.diyPlanId))),
        );
    }

    async function waitFor(desc: string, probe: () => Promise<boolean>, tries = 20): Promise<void> {
        for (let i = 0; i < tries; i++) {
            if (await probe()) {
                return;
            }
            await new Promise(r => setTimeout(r, 250));
        }
        throw new Error(`condition not met: ${desc}`);
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // bootstrap 已 seed 7 个平台分类 + bracelet-classic 模板 + 载体商品
        const cats = await adminClient.query(gql`
            query { diyCategories { id code } }
        `) as any;
        const agate = cats.diyCategories.find((c: any) => c.code === 'agate');
        const metal = cats.diyCategories.find((c: any) => c.code === 'metal');

        async function createMaterial(input: object): Promise<any> {
            const res = await adminClient.query(
                gql`
                    mutation ($input: DiyMaterialInput!) {
                        createDiyMaterial(input: $input) { id code stock enabled }
                    }
                `,
                { input },
            ) as any;
            return res.createDiyMaterial;
        }
        const main = await createMaterial({
            code: 'A-AGS-08-N',
            categoryId: numericId(agate.id),
            name: { 'zh-CN': '猫眼玛瑙' },
            shape: 'round',
            diameter: 8,
            axialLength: 8,
            holeSize: 1,
            price: 100,
            stock: 100,
            enabled: true,
        });
        mainId = main.id;
        const spacer = await createMaterial({
            code: 'M-SSP-04-SV',
            categoryId: numericId(metal.id),
            name: { 'zh-CN': '银色隔片' },
            shape: 'spacer',
            diameter: 4,
            axialLength: 1.5,
            holeSize: 1,
            price: 20,
            stock: 200,
            enabled: true,
        });
        spacerId = spacer.id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 模板与合并素材视图可见（两层合并 + 形状过滤）', async () => {
        const tpl = await shopClient.query(gql`
            query { diyShopTemplate(code: "bracelet-classic") { id code status calculatorKey } }
        `) as any;
        expect(tpl.diyShopTemplate.status).toBe('enabled');
        expect(tpl.diyShopTemplate.calculatorKey).toBe('bracelet');

        const all = await shopClient.query(gql`
            query { diyMaterials { items { id code stock enabled } total } }
        `) as any;
        expect(all.diyMaterials.total).toBe(2);

        const rounds = await shopClient.query(gql`
            query { diyMaterials(filter: { shapes: ["round"] }) { items { code } total } }
        `) as any;
        expect(rounds.diyMaterials.total).toBe(1);
        expect(rounds.diyMaterials.items[0].code).toBe('A-AGS-08-N');
    });

    it('2 createDiyPlan：服务端复算 22 颗，快照落库', async () => {
        const plan = await createPlan({
            slots: { main: { materialId: numericId(mainId) } },
            params: params155,
        });
        planId = plan.id;
        expect(plan.status).toBe('draft');
        expect(plan.calcVersion).toBe('1.0.0');
        expect(plan.bom.totalCount).toBe(22);
        expect(plan.bom.totalAmount).toBe(22 * 100);
        expect(plan.quoteNo).toBeNull();

        const mine = await shopClient.query(gql`
            query { myDiyPlans { items { id status } total } }
        `) as any;
        expect(mine.myDiyPlans.total).toBe(1);
        expect(mine.myDiyPlans.items[0].id).toBe(planId);
    });

    it('3 quoteDiyPlan：报价单号 + 7 天有效期 + 实时价覆盖', async () => {
        const res = await shopClient.query(gql`
            mutation { quoteDiyPlan(id: "${planId}") { id status quoteNo expiresAt bom } }
        `) as any;
        const plan = res.quoteDiyPlan;
        expect(plan.status).toBe('quoted');
        expect(plan.quoteNo).toMatch(/^DIY-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
        expect(plan.bom.totalAmount).toBe(22 * 100);
        const expires = new Date(plan.expiresAt).getTime();
        const now = Date.now();
        expect(expires).toBeGreaterThan(now + 6.9 * 24 * 3600 * 1000);
        expect(expires).toBeLessThan(now + 7.1 * 24 * 3600 * 1000);
    });

    it('4 createOrderFromPlan：成交价 = 实时复算价，素材库存扣减', async () => {
        const res = await shopClient.query(gql`
            mutation { createOrderFromPlan(id: "${planId}") { id status orderLineId } }
        `) as any;
        expect(res.createOrderFromPlan.status).toBe('ordered');
        expect(res.createOrderFromPlan.orderLineId).toBeTruthy();

        const order = await adminFindOrderWithPlan([planId]);
        expect(order).toBeDefined();
        // 核心默认订单状态机：addItemToOrder 后订单处于 AddingItems（Created 为加行前状态）
        expect(order.state).toBe('AddingItems');
        expect(order.totalWithTax).toBe(22 * 100);
        const line = order.lines.find((l: any) => Number(l.customFields?.diyPlanId) === numericId(planId));
        expect(line.quantity).toBe(1);
        expect(line.linePriceWithTax).toBe(22 * 100);
        expect(line.customFields.diyQuoteRefAmount).toBe(22 * 100);
        expect(JSON.parse(line.customFields.diyBom).totalCount).toBe(22);

        expect(await adminStock(mainId)).toBe(100 - 22);
    });

    it('5 并发抢库存：恰好一单成功，缺口明细报错，失败方零残留', async () => {
        await adminClient.query(gql`
            mutation { updateDiyMaterial(input: { id: "${mainId}", stock: 25 }) { id stock } }
        `) as any;

        const spec = { slots: { main: { materialId: numericId(mainId) } }, params: params155 };
        planB = (await createPlan(spec)).id;
        planC = (await createPlan(spec)).id;

        // 同一文档的顶层 mutation 字段按序执行：先者扣走 22（25→3），后者 WHERE stock >= 22 失败
        await expect(shopClient.query(gql`
            mutation {
                b: createOrderFromPlan(id: "${planB}") { id status }
                c: createOrderFromPlan(id: "${planC}") { id status }
            }
        `)).rejects.toThrow(/库存不足/);

        expect(await adminStock(mainId)).toBe(3);
        const ordered = [await shopPlan(planB), await shopPlan(planC)];
        expect(ordered.filter(p => p.status === 'ordered')).toHaveLength(1);
        // 零残留语义：失败的方案从未 quote（用例内直接 createPlan 为 draft），事务回滚后应保持 draft
        expect(ordered.filter(p => p.status === 'draft')).toHaveLength(1);
    });

    it('6 带隔片方案 BOM 聚合自洽（不变量断言）', async () => {
        const plan = await createPlan({
            slots: { main: { materialId: numericId(mainId) }, spacer: { materialId: numericId(spacerId), every: 2 } },
            params: params155,
        });
        expect(plan.bom.items).toHaveLength(2);
        const mainRow = plan.bom.items.find((i: any) => i.code === 'A-AGS-08-N');
        const spacerRow = plan.bom.items.find((i: any) => i.code === 'M-SSP-04-SV');
        expect(spacerRow.qty).toBe(Math.floor(plan.bom.totalCount / 3));
        expect(mainRow.qty + spacerRow.qty).toBe(plan.bom.totalCount);
        expect(mainRow.subtotal + spacerRow.subtotal).toBe(plan.bom.totalAmount);
    });

    it('7 取消订单：库存回补 + 方案回退 quoted', async () => {
        // 找到用例 5 成单的那个订单并取消
        const planIds = [planB, planC];
        let orderId = '';
        await waitFor('ordered plan found in orders', async () => {
            const order = await adminFindOrderWithPlan(planIds);
            if (order) {
                orderId = order.id;
                return true;
            }
            return false;
        });
        // 取消前先记录成单方案（取消后订阅者会把它回退 quoted，届时无法再判定）
        const orderedPlanId = (await shopPlan(planB)).status === 'ordered' ? planB : planC;
        await adminClient.query(gql`
            mutation {
                transitionOrderToState(id: "${orderId}", state: "Cancelled") {
                    __typename
                    ... on Order { id state }
                    ... on OrderStateTransitionError { errorCode message }
                }
            }
        `) as any;

        await waitFor('stock restored to 25', async () => (await adminStock(mainId)) === 25);
        await waitFor('plan back to quoted', async () => (await shopPlan(orderedPlanId)).status === 'quoted');
    });
});
