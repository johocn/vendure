import { Injectable, Inject } from '@nestjs/common';
import {
    Administrator,
    CustomerService,
    EntityNotFoundError,
    ID,
    Logger,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
} from '@vendure/core';
import { In } from 'typeorm';

import { Shop } from '@vendure/shop-plugin';

import { loggerCtx, NOTIFICATION_PLUGIN_OPTIONS } from './constants';
import { InboxMessage } from './inbox-message.entity';
import { NotifierProvider } from './notifier/notifier-provider';
import { InboxMessageListOptions, NotificationFrame, NotificationPluginOptions } from './types';

/**
 * 消息触达编排与站内信存储。
 * deliver(frame)：站内信真实落库（inboxEnabled 开关），再经 notifier 外发（微信，失败不阻断）。
 */
@Injectable()
export class NotificationService {
    private notifier: NotifierProvider;

    constructor(
        @Inject(NOTIFICATION_PLUGIN_OPTIONS) private options: NotificationPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private customerService: CustomerService,
    ) {
        this.notifier = {} as NotifierProvider;
    }

    /** 由插件 onApplicationBootstrap 注入 notifier（避免 DI 环）。 */
    init(notifier: NotifierProvider): void {
        this.notifier = notifier;
    }

    // ---------- 站内信存储 ----------

    /** 写一条站内信，返回落库实体。 */
    createInbox(ctx: RequestContext, frame: NotificationFrame, opts: {
        recipientType: 'customer' | 'admin';
        customerId?: number;
        administratorId?: number;
    }): Promise<InboxMessage> {
        const msg = new InboxMessage({
            channelId: ctx.channelId as number,
            recipientType: opts.recipientType,
            customerId: opts.customerId ?? null,
            administratorId: opts.administratorId ?? null,
            scene: frame.scene,
            title: frame.title,
            content: frame.content,
            link: frame.link ?? null,
            isRead: false,
        } as any);
        return this.connection.getRepository(ctx, InboxMessage).save(msg);
    }

    /** C 端收件箱：当前顾客的站内信（按 id 倒序）。 */
    async listCustomerInbox(ctx: RequestContext, options?: InboxMessageListOptions): Promise<{ items: InboxMessage[]; totalItems: number }> {
        const customer = await this.requireCustomer(ctx);
        const skip = options?.skip ?? 0;
        const take = options?.take ?? 50;
        const where = { customerId: customer.id, channelId: ctx.channelId as number } as any;
        const [items, totalItems] = await this.connection.getRepository(ctx, InboxMessage).findAndCount({
            where, order: { id: 'DESC' }, skip, take,
        });
        return { items, totalItems };
    }

    /** 店主/平台收件箱：当前登录管理员。 */
    async listAdminInbox(ctx: RequestContext, options?: InboxMessageListOptions): Promise<{ items: InboxMessage[]; totalItems: number }> {
        if (!ctx.activeUserId) throw new UnauthorizedError();
        const admin = await this.administratorForUser(ctx.activeUserId);
        const skip = options?.skip ?? 0;
        const take = options?.take ?? 50;
        const where = { administratorId: admin.id, channelId: ctx.channelId as number } as any;
        const [items, totalItems] = await this.connection.getRepository(ctx, InboxMessage).findAndCount({
            where, order: { id: 'DESC' }, skip, take,
        });
        return { items, totalItems };
    }

    /** 未读数。 */
    async unreadCount(ctx: RequestContext, t: 'customer' | 'admin' = 'customer'): Promise<number> {
        if (t === 'customer') {
            const c = await this.requireCustomer(ctx);
            return this.connection.getRepository(ctx, InboxMessage).count({
                where: { customerId: c.id, isRead: false, channelId: ctx.channelId as number } as any,
            });
        }
        if (!ctx.activeUserId) throw new UnauthorizedError();
        const admin = await this.administratorForUser(ctx.activeUserId);
        return this.connection.getRepository(ctx, InboxMessage).count({
            where: { administratorId: admin.id, isRead: false, channelId: ctx.channelId as number } as any,
        });
    }

    /** 置已读（仅本人）。 */
    async markRead(ctx: RequestContext, id: ID, t: 'customer' | 'admin'): Promise<InboxMessage> {
        const msg = await this.connection.getRepository(ctx, InboxMessage).findOne({
            where: { id: Number(id) } as any,
        });
        if (!msg) throw new EntityNotFoundError('InboxMessage', id);
        if (t === 'customer') {
            const c = await this.requireCustomer(ctx);
            if (msg.customerId !== c.id) throw new EntityNotFoundError('InboxMessage', id);
        } else {
            if (!ctx.activeUserId) throw new UnauthorizedError();
            const admin = await this.administratorForUser(ctx.activeUserId);
            if (msg.administratorId !== admin.id) throw new EntityNotFoundError('InboxMessage', id);
        }
        msg.isRead = true;
        msg.readAt = new Date();
        return this.connection.getRepository(ctx, InboxMessage).save(msg);
    }

    // ---------- 触发场景 ----------

    /** 订单状态迁移 → 买家/店主站内信 + 微信。 */
    async onOrderStateTransition(ctx: RequestContext, orderId: ID, toState: string): Promise<void> {
        const sceneMap: Record<string, string> = {
            PaymentSettled: 'order_paid',
            Shipped: 'order_shipped',
            Delivered: 'order_delivered',
            Completed: 'order_completed',
        };
        const scene = sceneMap[toState];
        if (!scene) return;

        // 传 relations 会覆盖默认值，必须显式带上 lines + lines.productVariant，
        // 否则 order.lines 为空，getOrderShopIds 无法反查到商品归属店铺（shop_new_order 永不触发）。
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer', 'customFields', 'lines', 'lines.productVariant',
        ] as any);
        if (!order) return;
        const title = this.titleFor(scene);
        const content = `您的订单 ${order.code} ${this.descFor(scene)}。`;

        if (order.customer?.id) {
            const frame: NotificationFrame = {
                scene, title, content, recipientType: 'customer',
                customerId: order.customer.id, templateParams: { orderCode: order.code },
            };
            await this.deliver(ctx, frame);
        }
        if (toState === 'PaymentSettled') {
            await this.notifyShopOwners(ctx, order, `新订单 ${order.code}`, `您有一笔新订单 ${order.code}，请尽快处理。`);
        }
    }

    /** 退款 Settled → 买家到账通知。 */
    async onRefundSettled(ctx: RequestContext, orderId: ID, refundTotalWithTax: number): Promise<void> {
        const order = await this.orderService.findOne(ctx, orderId, ['customer'] as any);
        if (!order || !order.customer?.id) return;
        await this.deliver(ctx, {
            scene: 'refund_settled',
            title: '退款到账',
            content: `订单 ${order.code} 退款 ¥${(refundTotalWithTax / 100).toFixed(2)} 已到账。`,
            recipientType: 'customer',
            customerId: order.customer.id,
            templateParams: { orderCode: order.code, amount: String(refundTotalWithTax) },
        });
    }

    // ---------- 工具 ----------

    private async deliver(ctx: RequestContext, frame: NotificationFrame): Promise<void> {
        if (frame.recipientType === 'customer') {
            if (this.options.inboxEnabled !== false && frame.customerId) {
                await this.createInbox(ctx, frame, { recipientType: 'customer', customerId: Number(frame.customerId) });
            }
        }
        try {
            if (this.notifier.send) {
                await this.notifier.send(frame);
            }
        } catch (e: any) {
            Logger.warn(`notifier error: ${e?.message}`, loggerCtx);
        }
    }

    /** 涉及店铺的店主收件箱推送（沿 Product.shopId → Shop.administratorId）。 */
    private async notifyShopOwners(ctx: RequestContext, order: any, title: string, content: string): Promise<void> {
        const shopIds = await this.getOrderShopIds(ctx, order);
        if (shopIds.length === 0) return;
        const shops = await this.connection.getRepository(ctx, Shop).find({
            where: { id: In(shopIds) } as any,
        });
        for (const shop of shops) {
            if (shop.administratorId == null) continue;
            await this.createInbox(ctx, { scene: 'shop_new_order', title, content, recipientType: 'admin' }, {
                recipientType: 'admin', administratorId: shop.administratorId,
            });
        }
    }

    /** 订单行 → productVariant.productId → Product.shopId 反查去重（对齐 address-plugin getOrderShopIds）。 */
    private async getOrderShopIds(ctx: RequestContext, order: any): Promise<number[]> {
        const productIds = [...new Set(
            (order.lines ?? [])
                .map((l: any) => Number(l.productVariant?.productId) || Number(l.productId))
                .filter((id: number) => id > 0),
        )];
        if (productIds.length === 0) return [];
        const products = await this.connection.getRepository(ctx, Product).find({
            where: { id: In(productIds) } as any,
        });
        return [...new Set(products.map((p: any) => Number(p.customFields?.shopId)).filter((id: number) => id > 0))];
    }

    private titleFor(scene: string): string {
        const m: Record<string, string> = {
            order_paid: '支付成功', order_shipped: '订单已发货', order_delivered: '订单已送达', order_completed: '交易完成',
        };
        return m[scene] ?? '订单通知';
    }

    private descFor(scene: string): string {
        const m: Record<string, string> = {
            order_paid: '已支付成功', order_shipped: '已发货', order_delivered: '已送达', order_completed: '已完成',
        };
        return m[scene] ?? '状态已更新';
    }

    private async requireCustomer(ctx: RequestContext): Promise<any> {
        if (!ctx.activeUserId) throw new UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new EntityNotFoundError('Customer', ctx.activeUserId);
        return customer;
    }

    /** 按登录 User 主键反查 Administrator（Administrator.user 关系）。 */
    private async administratorForUser(userId: ID): Promise<any> {
        const repo = this.connection.rawConnection.getRepository(Administrator);
        const a = await repo.findOne({ where: { user: { id: Number(userId) } } } as any);
        if (!a) throw new EntityNotFoundError('Administrator', userId);
        return a;
    }
}