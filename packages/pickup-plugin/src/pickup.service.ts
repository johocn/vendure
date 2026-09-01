import {
    AdministratorService,
    ForbiddenError,
    FulfillmentService,
    ID,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Inject, Injectable } from '@nestjs/common';
import { Shop } from '@vendure/shop-plugin';

import { PICKUP_PLUGIN_OPTIONS, PickupPluginOptions } from './constants';
import { PickupRedemption, PickupRedemptionStatus } from './pickup-redemption.entity';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去易混淆 0/O1/I/L

@Injectable()
export class PickupService {
    constructor(
        @Inject(PICKUP_PLUGIN_OPTIONS) private options: PickupPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private fulfillmentService: FulfillmentService,
        private administratorService: AdministratorService,
    ) {}

    private genCode(): string {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        return code;
    }

    private async genUniqueCode(ctx: RequestContext): Promise<string> {
        for (let i = 0; i < 10; i++) {
            const code = this.genCode();
            const hit = await this.connection
                .getRepository(ctx, PickupRedemption)
                .findOne({ where: { code } });
            if (!hit) return code;
        }
        throw new UserInputError('Failed to generate a unique pickup code');
    }

    async requireMyOrder(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        const uid = order?.customer?.user?.id;
        if (!order || !uid || uid !== ctx.activeUserId) {
            throw new ForbiddenError();
        }
        return order;
    }

    async requireMyShop(ctx: RequestContext): Promise<Shop> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) throw new ForbiddenError();
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { administratorId: admin.id as number } } as any);
        if (!shop || shop.status !== 'active') throw new ForbiddenError();
        return shop;
    }

    /** 收款判定（唯一真源）：online 恒已收；cod 看人工 confirmation。 */
    public effectiveCollected(redemption: PickupRedemption): boolean {
        return redemption.paymentType === 'online' || redemption.collected === true;
    }

    /**
     * 核销码生成资格：deliveryType=pickup 且已过「加购/付款中」阶段。
     * online → 需已结算（PaymentSettled 及之后）；cod（到店付款/货到付款）→ 授权即视为可核销，
     * 收款在核销完成时由店员确认（解决 PaymentAuthorized 不生成码的问题）。
     */
    private isPickupEligible(ctx: RequestContext, order: Order): boolean {
        const cf = (order.customFields ?? {}) as any;
        if (cf.deliveryType !== 'pickup') return false;
        if ((order.totalWithTax ?? 0) <= 0) return false;
        const ordering = ['AddingItems', 'ArrangingPayment', 'Draft', 'Cancelled'];
        if (ordering.includes(order.state as string)) return false;
        const payments = ((order as any).payments ?? []) as any[];
        const cod = payments.some(p => p?.method === 'cash-on-delivery');
        if (cod) return true; // 到店付款：授权即有资格，收款后核销
        // online：需已结算
        const notPaid = [...ordering, 'PaymentAuthorized'];
        return !notPaid.includes(order.state as string);
    }

    /**
     * 店归属强校验：被核销订单主商品的 Product.customFields.shopId 归店（与 settlement-plugin 阶段24
     * 按店拆账同一判据）。订单任一行商品归属本店即视为本店单，否则不归属。
     */
    private async orderBelongsToShop(ctx: RequestContext, orderId: ID, shopId: number): Promise<boolean> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ] as any);
        const lines = ((order as any)?.lines ?? []) as any[];
        if (lines.length === 0) {
            return false;
        }
        return lines.some((l: any) => {
            const sid = (l?.productVariant?.product?.customFields ?? {})?.shopId;
            return sid != null && Number(sid) === shopId;
        });
    }

    /** 懒生成/取回固定提货码（幂等：一生对一单）。 */
    async resolveMyPickupCode(ctx: RequestContext, orderId: ID): Promise<PickupRedemption> {
        const order = await this.requireMyOrder(ctx, orderId);
        if (!this.isPickupEligible(ctx, order)) {
            throw new UserInputError('Order is not a paid pickup order');
        }
        return this.getOrCreateRedemption(ctx, order);
    }

    private async getOrCreateRedemption(ctx: RequestContext, order: Order): Promise<PickupRedemption> {
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        const existing = await repo.findOne({ where: { orderId: order.id as number } });
        if (existing) return existing;
        const code = await this.genUniqueCode(ctx);
        const payments = ((order as any).payments ?? []) as any[];
        const paymentType: 'online' | 'cod' = payments.some(p => p?.method === 'cash-on-delivery') ? 'cod' : 'online';
        const entity = repo.create({
            channelId: ctx.channelId as number,
            orderId: order.id as number,
            code,
            status: 'generated',
            paymentType,
            collected: false,
        });
        const saved = await repo.save(entity);
        // 同步 Order.collected（online 置 true）
        if (paymentType === 'online') {
            await this.orderService.updateCustomFields(ctx, order.id as ID, { collected: true });
        }
        return saved;
    }

    /**
     * 为「已付款的 pickup 订单」幂等生成提货码（自动生码；供事件订阅与游客查询兜底调用）。
     * 非 pickup 或未过支付闸门（isPickupEligible：cod 授权即过）则不生成。
     */
    async ensurePickupRedemptionForOrder(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user'] as any);
        if (!order) return;
        const cf = (order.customFields ?? {}) as any;
        if (cf.deliveryType !== 'pickup') return;
        if (!this.isPickupEligible(ctx, order)) return;
        await this.getOrCreateRedemption(ctx, order);
    }

    /** 核销闸门：校验凭据存在且 generated。 */
    private async findGeneratable(
        ctx: RequestContext,
        orderId: ID,
        code: string,
    ): Promise<[Order, PickupRedemption]> {
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        const redemption = await repo.findOne({ where: { orderId: orderId as number } });
        if (!redemption) throw new UserInputError('Pickup code not found for order');
        if (redemption.status === 'void') throw new UserInputError('Pickup code has been voided');
        if (redemption.status === 'redeemed')
            throw new UserInputError('Pickup code already redeemed');
        if (redemption.code !== code) throw new UserInputError('Pickup code mismatch');
        const order = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        const shipped = (order?.fulfillments ?? []).some(f => f.state === 'Shipped');
        if (!shipped) throw new UserInputError('Order not ready for pickup (not Shipped)');
        return [order!, redemption];
    }

    /** 顾客自核销：仅线上已收款单可自助核销；到店付款单必须到店由店员收款核销（防漏收）。 */
    async claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption> {
        await this.requireMyOrder(ctx, orderId);
        const order = await this.orderService.findOne(ctx, orderId, ['payments'] as any);
        const payments = ((order as any)?.payments ?? []) as any[];
        if (payments.some(p => p?.method === 'cash-on-delivery')) {
            throw new UserInputError('该单为到店付款，请在到店时由店员核销');
        }
        return this.commitRedeem(ctx, orderId, code, 'customer');
    }

    /** 店员核销（仅本店订单，跨店抛 Forbidden）。到店付款单必须确认收款（collect=true）后才放行，防漏收。 */
    async claimPickupByShop(ctx: RequestContext, code: string, collect?: boolean): Promise<PickupRedemption> {
        // 先取店主所属店作为归属上下文
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        const redemption = await repo.findOne({ where: { code } });
        if (!redemption) throw new UserInputError('Pickup code not found');
        // 店归属强校验：被核销订单主商品必须归本店，否则跨店核销拒绝。
        const owns = await this.orderBelongsToShop(ctx, redemption.orderId, shop.id as number);
        if (!owns) {
            throw new ForbiddenError();
        }
        if (redemption.status !== 'generated') {
            throw new UserInputError('Pickup code already used / voided');
        }
        const order = await this.orderService.findOne(ctx, redemption.orderId, ['payments'] as any);
        const payments = ((order as any)?.payments ?? []) as any[];
        const cod = payments.some(p => p?.method === 'cash-on-delivery');
        if (cod && collect !== true) {
            throw new UserInputError('该单为到店付款，请先确认收款后再核销');
        }
        return this.commitRedeem(ctx, redemption.orderId, code, 'shop', cod ? true : undefined);
    }

    /** 店员核销凭据（到店或线上单通用）。仅设置 order.collected 与 redemption.collected。 */
    private async commitRedeem(
        ctx: RequestContext,
        orderId: ID,
        code: string,
        claimChannel: 'customer' | 'shop',
        collected?: boolean,
    ): Promise<PickupRedemption> {
        const [order, redemption] = await this.findGeneratable(ctx, orderId, code);
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        redemption.status = 'redeemed';
        redemption.claimedAt = new Date();
        redemption.claimedByUserId = ctx.activeUserId ? (ctx.activeUserId as number) : null;
        redemption.claimChannel = claimChannel;
        if (collected === true) redemption.collected = true;
        const saved = await repo.save(redemption);

        await this.connection.withTransaction(ctx, async txCtx => {
            await this.orderService.updateCustomFields(txCtx, orderId, {
                pickupClaimed: true,
                collected: collected === true ? true : undefined,
            });
            const withF = await this.orderService.findOne(txCtx, orderId, ['fulfillments']);
            for (const f of withF?.fulfillments ?? []) {
                if (f.state === 'Shipped') {
                    await this.fulfillmentService.transitionToState(txCtx, f.id, 'Delivered');
                }
            }
        });
        return saved;
    }

    async onOrderCancelled(orderId: number): Promise<void> {
        // 由 plugin 订阅事件调用；用无 ctx 的连接
        const repo = this.connection.rawConnection.getRepository(PickupRedemption);
        const r = await repo.findOne({ where: { orderId } });
        if (r && r.status === 'generated') {
            r.status = 'void';
            await repo.save(r);
        }
    }

    async myPickupOrders(ctx: RequestContext, options?: any) {
        // 店主域：本店待核销 pickup 订单 → 反查 PickupRedemption（generated）
        // 简化：返回其属店由 resolver 依 Order.customFields → 自提点 shop 过滤；缺省返回全部 generated
        return this.listRedemptions(ctx, options, 'generated');
    }

    private async listRedemptions(
        ctx: RequestContext,
        options: any = {},
        status?: PickupRedemptionStatus,
    ) {
        return this.connection
            .getRepository(ctx, PickupRedemption)
            .findAndCount({
                where: { ...(status ? { status } : {}) },
                take: options?.take ?? 20,
                skip: options?.skip ?? 0,
            });
    }

    async allRedemptions(ctx: RequestContext, options?: any) {
        const [items, totalItems] = await this.listRedemptions(ctx, options);
        return { items, totalItems };
    }

    /**
     * 本店商品订单：跨渠道归集「订单任一行商品 Product.customFields.shopId === 本店 id」的订单
     * （与核销/结算同判据）。商户商品在默认商城售出的订单归属默认渠道，此处必须跨渠道查询。
     */
    async myShopOrders(ctx: RequestContext, options: any = {}): Promise<{ items: Order[]; totalItems: number }> {
        const shop = await this.requireMyShop(ctx);
        const take = Math.min(options?.take ?? 20, 100);
        const skip = options?.skip ?? 0;
        const repo = this.connection.rawConnection.getRepository(Order);
        // 关联加载 lines→variant→product 以读取 Product.customFields.shopId；跨渠道取最近订单再在内存归集。
        const recent = await repo.find({
            relations: ['lines', 'lines.productVariant', 'lines.productVariant.product', 'customer', 'payments', 'channels'] as any,
            order: { id: 'DESC' },
            take: 1000,
        } as any);
        const matched = (recent as any[]).filter(o =>
            this.orderLineHasShop(o?.lines ?? [], shop.id as number),
        );
        return {
            items: matched.slice(skip, skip + take),
            totalItems: matched.length,
        };
    }

    private orderLineHasShop(lines: any[], shopId: number): boolean {
        return lines.some(l => {
            const sid = l?.productVariant?.product?.customFields?.shopId;
            return sid != null && Number(sid) === shopId;
        });
    }
}