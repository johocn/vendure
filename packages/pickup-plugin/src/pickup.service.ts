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

    private isPickupPaid(ctx: RequestContext, order: Order): boolean {
        const cf = (order.customFields ?? {}) as any;
        // 「已付款 pickup 单」：履约方式为 pickup，且订单已完成支付（授权/结算及之后的物流各态均算）。
        return (
            cf.deliveryType === 'pickup' &&
            ![
                'AddingItems',
                'ArrangingPayment',
                'Draft',
                'Cancelled',
                'PaymentAuthorized',
            ].includes(order.state as string) &&
            (order.totalWithTax ?? 0) > 0
        );
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
        if (!this.isPickupPaid(ctx, order)) {
            throw new UserInputError('Order is not a paid pickup order');
        }
        return this.getOrCreateRedemption(ctx, order);
    }

    private async getOrCreateRedemption(ctx: RequestContext, order: Order): Promise<PickupRedemption> {
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        const existing = await repo.findOne({ where: { orderId: order.id as number } });
        if (existing) return existing;
        const code = await this.genUniqueCode(ctx);
        const entity = repo.create({
            channelId: ctx.channelId as number,
            orderId: order.id as number,
            code,
            status: 'generated',
        });
        const saved = await repo.save(entity);
        return saved;
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

    /** 顾客自核销。 */
    async claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption> {
        await this.requireMyOrder(ctx, orderId);
        return this.commitRedeem(ctx, orderId, code, 'customer');
    }

    /** 店员核销（仅本店订单，跨店抛 Forbidden）。 */
    async claimPickupByShop(ctx: RequestContext, code: string): Promise<PickupRedemption> {
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
        return this.commitRedeem(ctx, redemption.orderId, code, 'shop');
    }

    private async commitRedeem(
        ctx: RequestContext,
        orderId: ID,
        code: string,
        claimChannel: 'customer' | 'shop',
    ): Promise<PickupRedemption> {
        const [order, redemption] = await this.findGeneratable(ctx, orderId, code);
        const repo = this.connection.getRepository(ctx, PickupRedemption);
        redemption.status = 'redeemed';
        redemption.claimedAt = new Date();
        redemption.claimedByUserId = ctx.activeUserId ? (ctx.activeUserId as number) : null;
        redemption.claimChannel = claimChannel;
        const saved = await repo.save(redemption);

        await this.connection.withTransaction(ctx, async txCtx => {
            await this.orderService.updateCustomFields(txCtx, orderId, { pickupClaimed: true });
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
}