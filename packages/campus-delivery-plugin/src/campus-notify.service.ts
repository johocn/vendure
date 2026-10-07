import { Injectable } from '@nestjs/common';
import { Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';

/** 用户侧节点通知触点（履约 5 + 用户订单域 4） */
export type CampusNotifyEvent =
    | 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered' | 'exceptionHandled'
    | 'orderPlaced' | 'paymentPending' | 'orderCancelled' | 'afterSales';

/** 触点 → 配置实体模板字段（值 = SSO msg-template 的 templateCode；未配置 = 该节点静默跳过） */
const TEMPLATE_FIELD: Record<CampusNotifyEvent, string> = {
    orderAccepted: 'notifyTemplateAccepted',
    riderAssigned: 'notifyTemplateRiderAssigned',
    cookingDone: 'notifyTemplateCookingDone',
    orderDelivered: 'notifyTemplateDelivered',
    exceptionHandled: 'notifyTemplateExceptionHandled',
    orderPlaced: 'notifyTemplateOrderPlaced',
    paymentPending: 'notifyTemplatePaymentPending',
    orderCancelled: 'notifyTemplateCancelled',
    afterSales: 'notifyTemplateAfterSales',
};

/** 状态文案（公众号模板 thing 字段 ≤20 字符） */
const STATUS_TEXT: Record<CampusNotifyEvent, string> = {
    orderAccepted: '商家已接单，备餐中',
    riderAssigned: '骑手已接单，待取货',
    cookingDone: '出餐完成，等待取货',
    orderDelivered: '订单已送达',
    exceptionHandled: '异常已处理',
    orderPlaced: '订单支付成功，商家接单中',
    paymentPending: '订单待支付，请尽快完成',
    orderCancelled: '订单已取消',
    afterSales: '售后进度更新',
};

/**
 * 用户侧节点通知（公众号模板消息，经 zhao-sso 服务间 API 发送）。
 * 链路：customer.customFields.ssoId（SSO 用户 id）→ POST {SSO_NOTIFY_BASE_URL}/v1/msg/template-send
 * （app_code+app_secret bcrypt 鉴权）→ SSO msg-job 落库 → 按绑定表解析 openid → 微信模板消息。
 * 环境变量：SSO_NOTIFY_BASE_URL（如 https://h.joho.cn/api/zhao-sso）、SSO_NOTIFY_APP_CODE、SSO_NOTIFY_APP_SECRET。
 * 设计约束：fire-and-forget——模板未配置/用户无 ssoId/SSO 未配置/发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 微信模板字段映射（character_string1/thing1/time2）由 SSO msg-template 的 wxTemplateFields 配置。
 */
@Injectable()
export class CampusNotifyService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
    ) {}

    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 status（如异常处置结果，超 20 字符自动截断）；h5BaseUrl：配置后消息带 url 跳 H5 订单详情落地页 */
    user(ctx: RequestContext, orderId: number | string, event: CampusNotifyEvent, text?: string, h5BaseUrl?: string): void {
        void (async () => {
            try {
                const baseUrl = process.env.SSO_NOTIFY_BASE_URL;
                const appCode = process.env.SSO_NOTIFY_APP_CODE;
                const appSecret = process.env.SSO_NOTIFY_APP_SECRET;
                if (!baseUrl || !appCode || !appSecret) {
                    Logger.debug('SSO notify env not configured (SSO_NOTIFY_BASE_URL/APP_CODE/APP_SECRET), skip', 'CampusNotify');
                    return;
                }
                const cfg = await this.config.getConfig(ctx);
                const templateCode = (cfg as any)[TEMPLATE_FIELD[event]] as string | null | undefined;
                if (!templateCode) {
                    Logger.debug(`channel ${ctx.channelId} has no ${TEMPLATE_FIELD[event]}, skip user notify`, 'CampusNotify');
                    return;
                }
                const order = await this.connection.getRepository(ctx, Order).findOne({
                    where: { id: orderId as any },
                    relations: ['customer'],
                });
                const ssoId = (order?.customer?.customFields as any)?.ssoId as string | number | undefined;
                if (!order || !ssoId) {
                    Logger.debug(
                        `order ${orderId} customer has no ssoId, skip user notify (${event})`,
                        'CampusNotify',
                    );
                    return;
                }
                const link = h5BaseUrl
                    ? `${h5BaseUrl.replace(/\/$/, '')}/#/pkg-order/pages/order-detail?code=${order.code}`
                    : undefined;
                const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/msg/template-send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        app_code: appCode,
                        app_secret: appSecret,
                        sso_user_id: Number(ssoId),
                        template_code: templateCode,
                        params: {
                            orderCode: order.code,
                            status: (text ?? STATUS_TEXT[event]).slice(0, 20),
                            time: CampusNotifyService.formatTime(new Date()),
                        },
                        link,
                        scene: `campus:${event}`,
                        dedupe_key: `campus:${event}:${orderId}`,
                    }),
                });
                const body = (await res.json().catch(() => null)) as any;
                if (!res.ok) {
                    throw new Error(`SSO api ${res.status}: ${body?.error ?? body?.error_description ?? 'unknown'}`);
                }
                Logger.info(
                    `user notify ${event} sent for ${order.code} (job=${(body?.data?.job?.id ?? body?.data?.id) ?? '?'} status=${body?.data?.job?.status ?? body?.data?.status ?? '?'})`,
                    'CampusNotify',
                );
            } catch (e: any) {
                Logger.warn(
                    `user notify ${event} for order ${orderId} failed: ${e?.message ?? e}`,
                    'CampusNotify',
                );
            }
        })();
    }

    static formatTime(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
}
