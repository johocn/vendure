import { Injector, Logger, Order, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { PreSaleActivity } from './pre-sale-activity.entity';

/**
 * 软依赖桥：运行时经 require + Injector.get(strict:false) 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null，pre-sale 回退旧行为（无期次）。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
export function tryGetScheduleService(injector: Injector): any | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PaymentScheduleService } = require('@vendure/payment-schedule-plugin');
        // Vendure Injector.get 内部即 moduleRef.get(token, { strict: false })，无需再传 options
        return injector.get(PaymentScheduleService) ?? null;
    } catch {
        return null;
    }
}

/** 尾款期触发器（按活动配置；date 的时间取尾款窗口起点，未定则退 releaseAt/endAt） */
function tailTrigger(activity: PreSaleActivity): Record<string, unknown> {
    switch (activity.tailTriggerType) {
        case 'group_buy':
            return { type: 'group_buy', groupBuyActivityId: activity.groupBuyActivityId };
        case 'manual':
            return { type: 'manual' };
        default:
            return {
                type: 'date',
                at: (activity.tailStartAt ?? activity.releaseAt ?? activity.endAt).toISOString(),
            };
    }
}

/**
 * 下单（applyPreSale）时生成期次实例：
 * - full：单 balance 项（首期立即可付）
 * - deposit：deposit + balance 双项；尾款期 trigger 按活动 tailTriggerType
 * 生成失败仅告警不阻断抢购（期次缺失时薄壳回退旧支付路径）。
 */
export async function createScheduleForOrder(
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    activity: PreSaleActivity,
): Promise<void> {
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService) return;
    if ((order.customFields as any)?.paymentScheduleId) return; // 幂等：已有期次
    try {
        if (activity.mode === 'full') {
            await scheduleService.createSchedule(ctx, {
                orderId: order.id,
                scenario: 'presale',
                deliveryGate: 'all_paid',
                depositRule: null,
                agreementVersion: activity.agreementVersion,
                shipDeadline: activity.shipDeadlineAt ?? null,
                items: [
                    {
                        seq: 1,
                        kind: 'balance',
                        amount: order.totalWithTax,
                        trigger: { type: 'date', at: new Date().toISOString() },
                        graceHours: activity.graceHours,
                    },
                ],
            });
        } else {
            const depositTotal = activity.depositAmount;
            const balanceTotal = Math.max(0, order.totalWithTax - depositTotal);
            const depositRule: Record<string, unknown> = { kind: activity.depositKind };
            if (activity.depositKind === 'earnest') {
                depositRule.earnestRefundPolicy = activity.earnestRefundPolicy ?? { onTimeout: 'full' };
            }
            await scheduleService.createSchedule(ctx, {
                orderId: order.id,
                scenario: 'presale',
                deliveryGate: 'all_paid',
                depositRule,
                agreementVersion: activity.agreementVersion,
                shipDeadline: activity.shipDeadlineAt ?? null,
                items: [
                    {
                        seq: 1,
                        kind: 'deposit',
                        amount: depositTotal,
                        trigger: { type: 'date', at: new Date().toISOString() },
                        graceHours: activity.graceHours,
                    },
                    {
                        seq: 2,
                        kind: 'balance',
                        amount: balanceTotal,
                        trigger: tailTrigger(activity),
                        graceHours: activity.graceHours,
                    },
                ],
            });
        }
        Logger.info(`Payment schedule created for pre-sale order ${order.code}`, loggerCtx);
    } catch (e: any) {
        Logger.error(`createScheduleForOrder failed for order ${order.code}: ${e.message}`, loggerCtx);
    }
}

/**
 * 薄壳支付转发：订单已有期次 → 调 paySchedulePeriod 支付指定 seq。
 * 返回 true=已走期次路径；false=无期次/未启用（调用方回退旧路径）。
 */
export async function payViaSchedule(
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    seq: number,
    method: string,
): Promise<boolean> {
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService) return false;
    if (!(order.customFields as any)?.paymentScheduleId) return false;
    await scheduleService.paySchedulePeriod(ctx, order.id, seq, method);
    return true;
}

/**
 * 薄壳尾款转发：强制解锁尾款期（legacy 窗口语义）→ 期次支付尾款期。
 */
export async function payTailViaSchedule(
    ctx: RequestContext,
    injector: Injector,
    order: Order,
    method: string,
): Promise<boolean> {
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService) return false;
    if (!(order.customFields as any)?.paymentScheduleId) return false;
    await scheduleService.unlockTailForOrder(ctx, order.id);
    const withItems = await scheduleService.getScheduleForOrder(ctx, order.id);
    const tail = (withItems?.items ?? []).find(
        (i: any) => i.kind === 'balance' && !['paid', 'refunded', 'waived', 'forfeited'].includes(i.status),
    );
    if (!tail) return false;
    await scheduleService.paySchedulePeriod(ctx, order.id, tail.seq, method);
    return true;
}
