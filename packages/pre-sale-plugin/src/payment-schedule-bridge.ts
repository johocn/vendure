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
