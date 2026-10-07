import { ChannelService, Injector, RequestContext } from '@vendure/core';

import { AfterSalesPluginOptions } from './types';

export interface AfterSalesThresholds {
    /** Pending 超时提醒商家（小时） */
    timeoutHours: number;
    /** Pending 超时自动同意（小时，0 = 关闭） */
    autoApproveHours: number;
    /** RefundFailed 自动重试次数（0 = 关闭） */
    refundAutoRetry: number;
}

const DEFAULTS: AfterSalesThresholds = { timeoutHours: 48, autoApproveHours: 0, refundAutoRetry: 1 };

/**
 * 解析售后自动化阈值：渠道 customFields → 插件 options → 内建默认（48 / 0 / 1）。
 * 事件 ctx.channel 已加载 customFields 时直接取；否则回退查库。
 */
export async function resolveAfterSalesThresholds(
    injector: Injector,
    ctx: RequestContext | null,
    channelId: number | string,
    options: AfterSalesPluginOptions,
): Promise<AfterSalesThresholds> {
    let cf: any = ctx ? (ctx.channel as any)?.customFields : undefined;
    if (!cf) {
        try {
            const channelService = injector.get(ChannelService);
            const channel = await channelService.findOne(RequestContext.empty(), channelId as any);
            cf = (channel as any)?.customFields;
        } catch {
            cf = undefined;
        }
    }
    const pick = (v: unknown, o: unknown, d: number): number => {
        const n = Number(v ?? o ?? d);
        return Number.isFinite(n) && n >= 0 ? n : d;
    };
    return {
        timeoutHours: pick(cf?.afterSalesTimeoutHours, options.afterSalesTimeoutHours, DEFAULTS.timeoutHours),
        autoApproveHours: pick(cf?.afterSalesAutoApproveHours, options.afterSalesAutoApproveHours, DEFAULTS.autoApproveHours),
        refundAutoRetry: pick(cf?.afterSalesRefundAutoRetry, options.afterSalesRefundAutoRetry, DEFAULTS.refundAutoRetry),
    };
}
