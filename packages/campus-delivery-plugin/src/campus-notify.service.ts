import { Injectable } from '@nestjs/common';
import { Channel, Logger, Order, RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusSmsService } from './campus-sms.service';
import { CompensationTaskService } from './compensation-task.service';

/** 用户侧节点通知触点（履约 7 + 用户订单域 4 + 改址 1） */
export type CampusNotifyEvent =
    | 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered' | 'exceptionHandled'
    | 'arrivedHandover' | 'deliveryFallback'
    | 'orderPlaced' | 'paymentPending' | 'orderCancelled' | 'afterSales' | 'addressChanged';

/** 触点 → 配置实体模板字段（值 = SSO msg-template 的 templateCode；未配置 = 该节点静默跳过） */
const TEMPLATE_FIELD: Record<CampusNotifyEvent, string> = {
    orderAccepted: 'notifyTemplateAccepted',
    riderAssigned: 'notifyTemplateRiderAssigned',
    cookingDone: 'notifyTemplateCookingDone',
    orderDelivered: 'notifyTemplateDelivered',
    exceptionHandled: 'notifyTemplateExceptionHandled',
    arrivedHandover: 'notifyTemplateArrivedHandover',
    deliveryFallback: 'notifyTemplateDeliveryFallback',
    orderPlaced: 'notifyTemplateOrderPlaced',
    paymentPending: 'notifyTemplatePaymentPending',
    orderCancelled: 'notifyTemplateCancelled',
    afterSales: 'notifyTemplateAfterSales',
    addressChanged: 'notifyTemplateAddressChanged',
};

/** 售后类型短语（微信 phrase 占位符 ≤5 字符） */
const AFTER_SALE_TYPE: Partial<Record<CampusNotifyEvent, string>> = {
    exceptionHandled: '异常已处理',
    afterSales: '进度更新',
};

/** 短信兜底文案（公众号模板消息不可用时发送，未配置短信网关则静默跳过） */
const SMS_EVENT_LABEL: Record<CampusNotifyEvent, string> = {
    orderAccepted: '商家已接单',
    riderAssigned: '骑手已接单',
    cookingDone: '餐品已出餐',
    orderDelivered: '订单已送达',
    exceptionHandled: '异常已处理',
    arrivedHandover: '已到校园交接点',
    deliveryFallback: '配送方式调整',
    orderPlaced: '下单成功',
    paymentPending: '待付款提醒',
    orderCancelled: '订单已取消',
    afterSales: '售后进度更新',
    addressChanged: '收货地址已变更',
};

/** 微信侧可能没有对应模板的触点：模板消息不可用时降级为站内信（C 端消息中心），不发短信 */
const INAPP_FALLBACK_EVENTS: ReadonlySet<CampusNotifyEvent> = new Set<CampusNotifyEvent>([
    'arrivedHandover',
    'deliveryFallback',
]);

// F7 最小补发：进程内重试 + 退避（首推失败不再只留一条日志）。
// 不落库（1G 小机避免加表/迁移）；dedupe_key 固定为 campus:{event}:{orderId}，
// SSO msg-job 侧按 key 幂等 → 超时重发不会产生重复消息。
const SEND_ATTEMPTS = 3;
const SEND_BACKOFF_MS = [2_000, 8_000];
const SEND_TIMEOUT_MS = 10_000;

/**
 * 用户侧节点通知（公众号模板消息，经 zhao-sso 服务间 API 发送）。
 * 链路：customer.customFields.ssoId（SSO 用户 id）→ POST {SSO_NOTIFY_BASE_URL}/v1/msg/template-send
 * （app_code+app_secret bcrypt 鉴权）→ SSO msg-job 落库 → 按绑定表解析 openid → 微信模板消息。
 * 环境变量：SSO_NOTIFY_BASE_URL（如 https://h.joho.cn/api/zhao-sso）、SSO_NOTIFY_APP_CODE、SSO_NOTIFY_APP_SECRET。
 * 设计约束：fire-and-forget——模板未配置/用户无 ssoId/SSO 未配置/发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 微信模板占位符映射由 SSO msg-template 的 wxTemplateFields 配置（name=微信占位符，key=本服务 params 键）。
 */
@Injectable()
export class CampusNotifyService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private sms: CampusSmsService,
        private compensation: CompensationTaskService,
        private requestContextService: RequestContextService,
    ) {}

    /** 重试任务使用的平台上下文（默认渠道），仅用于站内信落库（渠道取自任务记录） */
    private async platformCtx(): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin' });
    }

    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 status（如异常处置结果/改址新址，超 20 字符自动截断）；h5BaseUrl：配置后消息带 url 跳 H5 订单详情落地页；dedupeSuffix：同一订单多次同类事件（如多次改址）的幂等键后缀 */
    user(
        ctx: RequestContext,
        orderId: number | string,
        event: CampusNotifyEvent,
        text?: string,
        h5BaseUrl?: string,
        dedupeSuffix?: string,
    ): void {
        void (async () => {
            try {
                const baseUrl = process.env.SSO_NOTIFY_BASE_URL;
                const appCode = process.env.SSO_NOTIFY_APP_CODE;
                const appSecret = process.env.SSO_NOTIFY_APP_SECRET;
                if (!baseUrl || !appCode || !appSecret) {
                    Logger.debug('SSO notify env not configured (SSO_NOTIFY_BASE_URL/APP_CODE/APP_SECRET), skip', 'CampusNotify');
                    await this.fallback(ctx, orderId, event, text);
                    return;
                }
                const cfg = await this.config.getConfig(ctx);
                const templateCode = (cfg as any)[TEMPLATE_FIELD[event]] as string | null | undefined;
                if (!templateCode) {
                    Logger.debug(`channel ${ctx.channelId} has no ${TEMPLATE_FIELD[event]}, skip user notify`, 'CampusNotify');
                    await this.fallback(ctx, orderId, event, text);
                    return;
                }
                const order = await this.connection.getRepository(ctx, Order).findOne({
                    where: { id: orderId as any },
                    relations: ['customer', 'lines', 'lines.productVariant'],
                });
                const ssoId = (order?.customer?.customFields as any)?.ssoId as string | number | undefined;
                if (!order || ssoId == null || ssoId === '') {
                    Logger.debug(
                        `order ${orderId} customer has no ssoId, skip user notify (${event})`,
                        'CampusNotify',
                    );
                    await this.fallback(ctx, orderId, event, text);
                    return;
                }
                // sso_user_id 必须是数字：非数字（脏数据/占位串）会让下游按 NaN 落库，这里提前拦下
                const ssoUserId = Number(ssoId);
                if (!Number.isFinite(ssoUserId)) {
                    Logger.warn(
                        `order ${orderId} customer ssoId is not numeric (${String(ssoId)}), skip user notify (${event})`,
                        'CampusNotify',
                    );
                    await this.fallback(ctx, orderId, event, text);
                    return;
                }
                // 微信模板字段必填：按事件分型组装 params（与 sso_msg_templates.wx_template_fields 的 key 对应）
                const lines = order.lines ?? [];
                const firstName = lines[0]?.productVariant?.name ?? '商品';
                const itemName = (lines.length > 1 ? `${firstName} 等${lines.length}件` : firstName).slice(0, 20);
                const amount = ((order.totalWithTax ?? 0) / 100).toFixed(2);
                const params =
                    event === 'orderCancelled'
                        ? { orderCode: order.code, itemName, refundAmount: amount }
                        : event === 'arrivedHandover'
                        ? { orderCode: order.code, itemName, handoverPoint: (text ?? '校园交接点').slice(0, 20) }
                        : event === 'deliveryFallback'
                        ? { orderCode: order.code, itemName, reason: (text ?? '配送方式调整').slice(0, 20) }
                        : event === 'addressChanged'
                        ? { orderCode: order.code, itemName, newAddress: (text ?? '').slice(0, 20) }
                        : event === 'afterSales' || event === 'exceptionHandled'
                        ? {
                              orderCode: order.code,
                              itemName,
                              afterSaleType: (text ?? AFTER_SALE_TYPE[event] ?? '进度更新').slice(0, 5),
                          }
                        : { orderCode: order.code, itemName, amount, payMethod: '在线支付' };
                const link = h5BaseUrl
                    ? `${h5BaseUrl.replace(/\/$/, '')}/#/pkg-order/pages/order-detail?code=${order.code}`
                    : undefined;
                const payload = JSON.stringify({
                    app_code: appCode,
                    app_secret: appSecret,
                    sso_user_id: ssoUserId,
                    template_code: templateCode,
                    params,
                    link,
                    scene: `campus:${event}`,
                    dedupe_key: `campus:${event}:${orderId}${dedupeSuffix ? `:${dedupeSuffix}` : ''}`,
                });
                // 发送 + 退避重试：2s / 8s，单次超时 10s；dedupe_key 幂等，重发不产生重复消息
                let lastErr: unknown;
                for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
                    try {
                        if (attempt > 1) {
                            await new Promise(r => setTimeout(r, SEND_BACKOFF_MS[attempt - 2]));
                        }
                        const body = await this.sendOnce(baseUrl, payload);
                        Logger.info(
                            `user notify ${event} sent for ${order.code} (job=${(body?.data?.job?.id ?? body?.data?.id) ?? '?'} status=${body?.data?.job?.status ?? body?.data?.status ?? '?'})`,
                            'CampusNotify',
                        );
                        return;
                    } catch (e: any) {
                        lastErr = e;
                        Logger.warn(
                            `user notify ${event} for order ${orderId} attempt ${attempt}/${SEND_ATTEMPTS} failed: ${e?.message ?? e}`,
                            'CampusNotify',
                        );
                    }
                }
                Logger.error(
                    `user notify ${event} for order ${orderId} dropped after ${SEND_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
                    'CampusNotify',
                );
                await this.fallback(ctx, orderId, event, text);
            } catch (e: any) {
                Logger.warn(
                    `user notify ${event} for order ${orderId} failed: ${e?.message ?? e}`,
                    'CampusNotify',
                );
            }
        })();
    }

    /** 模板消息不可用时的兜底：微信侧可能无模板的触点走站内信，其余维持短信兜底 */
    private async fallback(
        ctx: RequestContext,
        orderId: number | string,
        event: CampusNotifyEvent,
        text?: string,
    ): Promise<void> {
        if (INAPP_FALLBACK_EVENTS.has(event)) {
            await this.inAppFallback(ctx, orderId, event, text);
            return;
        }
        await this.smsFallback(ctx, orderId, event, text);
    }

    /**
     * 站内信兜底：复用 message-plugin 的 Message/MessageDelivery（与 support.service 同范式）。
     * 未装 message-plugin / 订单或顾客缺失时静默跳过，绝不阻塞主流程。
     */
    private async inAppFallback(
        ctx: RequestContext,
        orderId: number | string,
        event: CampusNotifyEvent,
        text?: string,
    ): Promise<void> {
        let orderCode: string | undefined;
        let customerId: number | undefined;
        try {
            const order = await this.connection.getRepository(ctx, Order).findOne({
                where: { id: orderId as any },
                relations: ['customer'],
            });
            customerId = order?.customer?.id == null ? undefined : Number(order.customer.id);
            if (!order || customerId == null) return;
            orderCode = order.code;
            await this.writeInApp(ctx, order.code, customerId, event, text, ctx.channel);
            Logger.info(`in-app notify ${event} sent for ${order.code}`, 'CampusNotify');
        } catch (e: any) {
            Logger.warn(`in-app notify ${event} for order ${orderId} failed: ${e?.message ?? e}`, 'CampusNotify');
            // R2：站内信落库失败不阻塞主流程，但必须持久化重试（否则顾客永久收不到）
            void this.compensation.enqueueNotify({
                orderId: Number(orderId),
                channelId: ctx.channelId as number,
                customerId,
                orderCode,
                event,
                text,
            });
        }
    }

    /** 站内信写入（正常路径与补偿重试共用）；失败由调用方决定告警/入队 */
    private async writeInApp(
        ctx: RequestContext,
        orderCode: string,
        customerId: number,
        event: CampusNotifyEvent,
        text: string | undefined,
        channel: Channel | undefined,
    ): Promise<void> {
        const title = event === 'arrivedHandover' ? '订单已到校园交接点' : '配送方式调整';
        const body =
            event === 'arrivedHandover'
                ? `订单 ${orderCode} 已到达${text || '校园交接点'}，正在安排校内接力配送。`
                : `订单 ${orderCode} ${text || '配送方式调整'}，配送时效可能略有延迟，请留意后续通知。`;
        const channelRef = channel ? [channel] : [];
        const msgRepo = this.connection.getRepository(ctx, 'Message' as any);
        const deliveryRepo = this.connection.getRepository(ctx, 'MessageDelivery' as any);
        const message = await msgRepo.save(
            msgRepo.create({
                title,
                body,
                deliveryChannel: 'inapp',
                audienceType: 'all',
                status: 'sent',
                totalTarget: 1,
                totalSent: 1,
                sentAt: new Date(),
                channels: channelRef,
            }),
        );
        await deliveryRepo.save(
            deliveryRepo.create({
                messageId: message.id,
                customerId,
                deliveryStatus: 'sent',
                channels: channelRef,
            }),
        );
    }

    /** 补偿任务重放：用平台上下文重做一次站内信写入（渠道取自任务记录，保证与原消息一致） */
    async retryInApp(orderId: number, channelId: number, event: CampusNotifyEvent, text?: string): Promise<void> {
        const pc = await this.platformCtx();
        const order = await this.connection.getRepository(pc, Order).findOne({
            where: { id: orderId as any },
            relations: ['customer'],
        });
        const customerId = order?.customer?.id == null ? undefined : Number(order.customer.id);
        // 订单/顾客已不存在：视为已无法补偿，返回即让任务标记 done，避免无限重试
        if (!order || customerId == null) return;
        const channel = (await this.connection
            .getRepository(pc, Channel)
            .findOne({ where: { id: channelId as any } })) ?? undefined;
        await this.writeInApp(pc, order.code, customerId, event, text, channel);
        Logger.info(`in-app notify ${event} retried for ${order.code}`, 'CampusNotify');
    }

    /** 短信兜底：公众号模板消息不可用（未配模板/无 ssoId/发送失败）时补发一条短信；未配网关静默跳过 */
    private async smsFallback(
        ctx: RequestContext,
        orderId: number | string,
        event: CampusNotifyEvent,
        text?: string,
    ): Promise<void> {
        if (!this.sms.configured) return;
        try {
            const order = await this.connection.getRepository(ctx, Order).findOne({
                where: { id: orderId as any },
                relations: ['customer'],
            });
            const phone = order?.customer?.phoneNumber;
            if (!order || !phone) return;
            const extra = text ? `，${text}` : '';
            const content = `【校园外卖】${SMS_EVENT_LABEL[event]}：订单 ${order.code}${extra}，详情请打开小程序查看。`;
            const ok = await this.sms.send(phone, content.slice(0, 120));
            if (ok) Logger.info(`sms fallback sent for ${order.code} (${event})`, 'CampusNotify');
        } catch (e: any) {
            Logger.warn(`sms fallback failed for order ${orderId} (${event}): ${e?.message ?? e}`, 'CampusNotify');
        }
    }

    /** 单次发送（10s 超时）；非 2xx 或响应体异常抛错由上层重试 */
    private async sendOnce(baseUrl: string, payload: string): Promise<any> {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/msg/template-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        const body = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
            throw new Error(`SSO api ${res.status}: ${body?.error ?? body?.error_description ?? 'unknown'}`);
        }
        return body;
    }

}
