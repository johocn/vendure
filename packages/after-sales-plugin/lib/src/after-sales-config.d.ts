import { Injector, RequestContext } from '@vendure/core';
import { AfterSalesPluginOptions } from './types';
export interface AfterSalesThresholds {
    /** Pending 超时提醒商家（小时） */
    timeoutHours: number;
    /** Pending 超时自动同意（小时，0 = 关闭） */
    autoApproveHours: number;
    /** RefundFailed 自动重试次数（0 = 关闭） */
    refundAutoRetry: number;
}
/**
 * 解析售后自动化阈值：渠道 customFields → 插件 options → 内建默认（48 / 0 / 1）。
 * 事件 ctx.channel 已加载 customFields 时直接取；否则回退查库。
 */
export declare function resolveAfterSalesThresholds(injector: Injector, ctx: RequestContext | null, channelId: number | string, options: AfterSalesPluginOptions): Promise<AfterSalesThresholds>;
