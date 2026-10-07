import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { WechatAuthService } from '@vendure/wechat-auth-plugin';
import { CampusConfigService } from './campus-config.service';

/** 用户侧节点通知触点（履约 5 + 用户订单域 4） */
export type CampusNotifyEvent =
    | 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered' | 'exceptionHandled'
    | 'orderPlaced' | 'paymentPending' | 'orderCancelled' | 'afterSales';

/** 触点 → 配置实体模板 ID 字段（未配置 = 该节点静默跳过） */
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
 * 用户侧节点通知（公众号模板消息，touser = Customer.customFields.wechatOpenid）。
 * 设计约束：fire-and-forget——模板未配置/用户无 openid（未关注公众号）/服务未注册/
 * 发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 字段名映射（character_string1/thing1/time2）按申请到的订单类模板而定，
 * 若模板字段不同仅需调整本文件 buildData 一处。
 */
@Injectable()
export class CampusNotifyService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private moduleRef: ModuleRef,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（与 hall.service 同款惰性解析，避免插件未注册时构造期报错） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 thing1（如异常处置结果，超 20 字符自动截断）；h5BaseUrl：配置后模板消息带 url 跳 H5 订单详情落地页 */
    user(ctx: RequestContext, orderId: number | string, event: CampusNotifyEvent, text?: string, h5BaseUrl?: string): void {
        void (async () => {
            try {
                const cfg = await this.config.getConfig(ctx);
                const templateId = (cfg as any)[TEMPLATE_FIELD[event]] as string | null | undefined;
                if (!templateId) {
                    Logger.debug(`channel ${ctx.channelId} has no ${TEMPLATE_FIELD[event]}, skip user notify`, 'CampusNotify');
                    return;
                }
                const order = await this.connection.getRepository(ctx, Order).findOne({
                    where: { id: orderId as any },
                    relations: ['customer'],
                });
                const openid = (order?.customer?.customFields as any)?.wechatOpenid as string | undefined;
                if (!order || !openid) {
                    Logger.debug(
                        `order ${orderId} customer has no wechatOpenid, skip user notify (${event})`,
                        'CampusNotify',
                    );
                    return;
                }
                const wx = this.injector.get(WechatAuthService);
                const res = await wx.sendTemplate({
                    touser: openid,
                    template_id: templateId,
                    data: this.buildData(order.code, event, text),
                    ...(h5BaseUrl ? { url: `${h5BaseUrl.replace(/\/$/, '')}/#/pkg-order/pages/order-detail?code=${order.code}` } : {}),
                });
                Logger.info(
                    `user notify ${event} sent for ${order.code} (msgid=${(res as any)?.msgid ?? '?'})`,
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

    /** 模板字段映射（订单号/状态/时间），字段名以申请到的模板为准 */
    private buildData(orderCode: string, event: CampusNotifyEvent, text?: string) {
        return {
            character_string1: { value: orderCode },
            thing1: { value: (text ?? STATUS_TEXT[event]).slice(0, 20) },
            time2: { value: CampusNotifyService.formatTime(new Date()) },
        };
    }

    static formatTime(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
}
