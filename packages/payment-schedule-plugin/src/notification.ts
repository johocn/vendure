import { Logger, Order, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import { tryGetProvider } from './payment-schedule-runtime';

export type ScheduleTemplateKey =
    | 'scheduleTailOpenedTemplateId'
    | 'scheduleOverdueTemplateId'
    | 'scheduleBreachNoticeTemplateId'
    | 'scheduleRefundTemplateId';

/**
 * 调度通知：模板 id 从渠道 customFields 读取（与 orderPaidTemplateId 同机制），
 * 经 wechat-subscribe-message-plugin 的 SubscribeMessageService.sendCustomMessage 发送。
 * 软依赖：插件未安装 / 渠道未配置模板 / 无 openid 一律静默跳过。
 */
export async function sendScheduleNotice(
    ctx: RequestContext,
    order: Order | null | undefined,
    templateKey: ScheduleTemplateKey,
    data: Record<string, { value: string; color?: string }>,
): Promise<void> {
    try {
        if (!order?.customer) return;
        const cf = (ctx.channel as any)?.customFields ?? {};
        const templateId = cf[templateKey];
        if (!templateId) {
            Logger.debug(`Channel ${ctx.channelId} has no ${templateKey}, skip schedule notice`, loggerCtx);
            return;
        }
        const svc = tryGetProvider<any>(
            require('@vendure/wechat-subscribe-message-plugin').SubscribeMessageService,
        );
        if (!svc) {
            Logger.debug('wechat-subscribe-message-plugin not installed, skip schedule notice', loggerCtx);
            return;
        }
        await svc.sendCustomMessage(ctx, order.customer.id, templateId, data);
    } catch (e: any) {
        Logger.warn(`Schedule notice failed for order ${order?.code}: ${e?.message ?? e}`, loggerCtx);
    }
}
