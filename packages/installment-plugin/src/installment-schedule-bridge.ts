import { Injector, Logger, Order, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { InstallmentPlan } from './installment-plan.entity';

/**
 * 软依赖桥：运行时经 require + Injector.get 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null，分期退化为普通订单支付。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
export function tryGetScheduleService(injector: Injector): any | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PaymentScheduleService } = require('@vendure/payment-schedule-plugin');
        // Vendure Injector.get 内部即 moduleRef.get(token, { strict: false })，无需再传 options（同 pre-sale 桥）
        return injector.get(PaymentScheduleService) ?? null;
    } catch {
        return null;
    }
}

/**
 * 结算页选择分期（enableInstallment）时生成期次实例：
 * 首付项（down_payment，ratio>0 时）+ N 期 installment（interval trigger）。
 * deliveryGate=first_period（付首付即可发货）；depositRule=down_payment（无罚则）。
 */
export async function createInstallmentSchedule(
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    plan: InstallmentPlan,
    graceHours: number,
): Promise<void> {
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService) return;
    if ((order.customFields as any)?.paymentScheduleId) return; // 幂等
    try {
        // Task 2 实装签名：(total, downRatioPercent, periods) → [首付, 期1..期n]
        // （首付=floor(total*ratio%)，余款均分、余数并入末期）——金额语义与计划一致
        const { splitInstallmentAmounts } = require('@vendure/payment-schedule-plugin');
        const [down, ...amounts] = splitInstallmentAmounts(
            order.totalWithTax,
            plan.downPaymentRatio,
            plan.periods,
        ) as number[];
        const now = new Date();
        const items: Record<string, unknown>[] = [];
        let seq = 1;
        if (down > 0) {
            items.push({
                seq: seq++,
                kind: 'down_payment',
                amount: down,
                trigger: { type: 'date', at: now.toISOString() },
                graceHours,
            });
        }
        amounts.forEach((amount, i) => {
            items.push({
                seq: seq++,
                kind: 'installment',
                amount,
                allowCod: plan.allowCod,
                trigger: {
                    type: 'interval',
                    unit: plan.intervalUnit,
                    count: plan.intervalCount * (i + 1),
                    anchor: 'order_placed',
                },
                graceHours,
            });
        });
        await scheduleService.createSchedule(ctx, {
            orderId: order.id,
            scenario: 'installment',
            deliveryGate: 'first_period',
            depositRule: { kind: 'down_payment' },
            agreementVersion: 'v1',
            items,
        });
        Logger.info(`Installment schedule created for order ${order.code} (plan ${plan.id})`, loggerCtx);
    } catch (e: any) {
        Logger.error(`createInstallmentSchedule failed for order ${order.code}: ${e.message}`, loggerCtx);
        throw e;
    }
}
