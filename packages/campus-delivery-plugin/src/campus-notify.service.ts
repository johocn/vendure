import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { WechatAuthService } from '@vendure/wechat-auth-plugin';
import { CampusConfigService } from './campus-config.service';

/** 用户侧节点通知触点 */
export type CampusNotifyEvent = 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered';

/** 触点 → 配置实体模板 ID 字段（未配置 = 该节点静默跳过） */
const TEMPLATE_FIELD: Record<CampusNotifyEvent, string> = {
    orderAccepted: 'notifyTemplateAccepted',
    riderAssigned: 'notifyTemplateRiderAssigned',
    cookingDone: 'notifyTemplateCookingDone',
    orderDelivered: 'notifyTemplateDelivered',
};

/** 状态文案（公众号模板 thing 字段 ≤20 字符） */
const STATUS_TEXT: Record<CampusNotifyEvent, string> = {
    orderAccepted: '商家已接单，备餐中',
    riderAssigned: '骑手已接单，待取货',
    cookingDone: '出餐完成，等待取货',
    orderDelivered: '订单已送达',
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

    /** 发送节点通知（异步不等待，不抛错） */
    user(ctx: RequestContext, orderId: number | string, event: CampusNotifyEvent): void {
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
                    data: this.buildData(order.code, event),
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
    private buildData(orderCode: string, event: CampusNotifyEvent) {
        return {
            character_string1: { value: orderCode },
            thing1: { value: STATUS_TEXT[event] },
            time2: { value: CampusNotifyService.formatTime(new Date()) },
        };
    }

    static formatTime(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
}
