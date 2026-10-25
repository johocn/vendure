import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusSmsService } from './campus-sms.service';
/** 用户侧节点通知触点（履约 5 + 用户订单域 4 + 改址 1） */
export type CampusNotifyEvent = 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered' | 'exceptionHandled' | 'orderPlaced' | 'paymentPending' | 'orderCancelled' | 'afterSales' | 'addressChanged';
/**
 * 用户侧节点通知（公众号模板消息，经 zhao-sso 服务间 API 发送）。
 * 链路：customer.customFields.ssoId（SSO 用户 id）→ POST {SSO_NOTIFY_BASE_URL}/v1/msg/template-send
 * （app_code+app_secret bcrypt 鉴权）→ SSO msg-job 落库 → 按绑定表解析 openid → 微信模板消息。
 * 环境变量：SSO_NOTIFY_BASE_URL（如 https://h.joho.cn/api/zhao-sso）、SSO_NOTIFY_APP_CODE、SSO_NOTIFY_APP_SECRET。
 * 设计约束：fire-and-forget——模板未配置/用户无 ssoId/SSO 未配置/发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 微信模板占位符映射由 SSO msg-template 的 wxTemplateFields 配置（name=微信占位符，key=本服务 params 键）。
 */
export declare class CampusNotifyService {
    private connection;
    private config;
    private sms;
    constructor(connection: TransactionalConnection, config: CampusConfigService, sms: CampusSmsService);
    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 status（如异常处置结果/改址新址，超 20 字符自动截断）；h5BaseUrl：配置后消息带 url 跳 H5 订单详情落地页；dedupeSuffix：同一订单多次同类事件（如多次改址）的幂等键后缀 */
    user(ctx: RequestContext, orderId: number | string, event: CampusNotifyEvent, text?: string, h5BaseUrl?: string, dedupeSuffix?: string): void;
    /** 短信兜底：公众号模板消息不可用（未配模板/无 ssoId/发送失败）时补发一条短信；未配网关静默跳过 */
    private smsFallback;
    /** 单次发送（10s 超时）；非 2xx 或响应体异常抛错由上层重试 */
    private sendOnce;
}
