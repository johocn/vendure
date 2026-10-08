import { Order, RequestContext } from '@vendure/core';
export type ScheduleTemplateKey = 'scheduleTailOpenedTemplateId' | 'scheduleOverdueTemplateId' | 'scheduleBreachNoticeTemplateId' | 'scheduleRefundTemplateId';
/**
 * 调度通知：模板 id 从渠道 customFields 读取（与 orderPaidTemplateId 同机制），
 * 经 wechat-subscribe-message-plugin 的 SubscribeMessageService.sendCustomMessage 发送。
 * 软依赖：插件未安装 / 渠道未配置模板 / 无 openid 一律静默跳过。
 */
export declare function sendScheduleNotice(ctx: RequestContext, order: Order | null | undefined, templateKey: ScheduleTemplateKey, data: Record<string, {
    value: string;
    color?: string;
}>): Promise<void>;
