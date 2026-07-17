import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    Order,
    OrderService,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { CouponCodeStatus, loggerCtx } from './constants';
import { CouponCode } from './coupon-code.entity';
import { Coupon } from './coupon.entity';

export interface CouponOrderLineInput {
    productId: number;
    variantId: number;
    quantity: number;
    lineTotal: number;
    collectionIds: number[];
}

export interface CouponValidationResult {
    valid: boolean;
    discountAmount: number;
    error: string | null;
}

/** 订单状态若处于以下集合之外，视为“已下单”（用于新人券判定）。 */
const NON_PLACED_STATES = ['Draft', 'AddingItems', 'ArrangingPayment', 'Cancelled'];

@Injectable()
export class CouponService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
        private orderService: OrderService,
    ) {}

    // ===== Admin CRUD =====

    async getCoupons(
        ctx: RequestContext,
        options?: ListQueryOptions<Coupon>,
    ): Promise<PaginatedList<Coupon>> {
        return this.listQueryBuilder
            .build(Coupon, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async getCoupon(ctx: RequestContext, id: ID): Promise<Coupon | null> {
        return this.connection.getRepository(ctx, Coupon).findOne({
            where: { id: id as any },
            relations: ['channels'],
        });
    }

    async createCoupon(ctx: RequestContext, input: Partial<Coupon>): Promise<Coupon> {
        if (!input.name) throw new UserInputError('name is required');
        if (!input.couponType) throw new UserInputError('couponType is required');
        if (input.discountValue == null) throw new UserInputError('discountValue is required');
        if (!input.startAt || !input.endAt) throw new UserInputError('startAt and endAt are required');
        if (input.totalQuantity == null) throw new UserInputError('totalQuantity is required');

        const coupon = new Coupon({
            name: input.name,
            description: input.description ?? null,
            couponType: input.couponType,
            discountValue: input.discountValue,
            minSpend: input.minSpend ?? 0,
            maxDiscount: input.maxDiscount ?? 0,
            startAt: input.startAt,
            endAt: input.endAt,
            totalQuantity: input.totalQuantity,
            claimedCount: 0,
            limitPerUser: input.limitPerUser ?? 1,
            isActive: input.isActive ?? true,
            applicableProductIds: input.applicableProductIds ?? null,
            applicableCategoryIds: input.applicableCategoryIds ?? null,
            isNewUserOnly: input.isNewUserOnly ?? false,
        });
        coupon.channels = [ctx.channel];
        return this.connection.getRepository(ctx, Coupon).save(coupon);
    }

    /** updateCoupon 字段白名单：不允许修改 claimedCount / couponType / discountValue。 */
    async updateCoupon(ctx: RequestContext, id: ID, input: Partial<Coupon>): Promise<Coupon> {
        const repo = this.connection.getRepository(ctx, Coupon);
        const coupon = await repo.findOne({ where: { id: id as any } });
        if (!coupon) throw new EntityNotFoundError('Coupon', id);

        if (input.name != null) coupon.name = input.name;
        if (input.description != null) coupon.description = input.description;
        if (input.startAt != null) coupon.startAt = input.startAt;
        if (input.endAt != null) coupon.endAt = input.endAt;
        if (input.totalQuantity != null) coupon.totalQuantity = input.totalQuantity;
        if (input.limitPerUser != null) coupon.limitPerUser = input.limitPerUser;
        if (input.isActive != null) coupon.isActive = input.isActive;

        return repo.save(coupon);
    }

    async deleteCoupon(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, Coupon);
        const coupon = await repo.findOne({ where: { id: id as any } });
        if (!coupon) return false;
        await repo.remove(coupon);
        return true;
    }

    // ===== Shop: claim / list / validate / redeem / release =====

    /** 可领取的券：当前 channel、激活、活动期内、有库存。 */
    async getAvailableCoupons(ctx: RequestContext): Promise<Coupon[]> {
        const now = new Date();
        const repo = this.connection.getRepository(ctx, Coupon);
        return repo
            .createQueryBuilder('coupon')
            .leftJoinAndSelect('coupon.channels', 'channel')
            .where('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('coupon.isActive = :active', { active: true })
            .andWhere('coupon.startAt <= :now', { now })
            .andWhere('coupon.endAt >= :now', { now })
            .andWhere('coupon.totalQuantity > coupon.claimedCount')
            .getMany();
    }

    async claimCoupon(ctx: RequestContext, couponId: ID): Promise<CouponCode> {
        if (!ctx.activeUserId) throw new UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new EntityNotFoundError('Customer', ctx.activeUserId);

        const coupon = await this.connection.getRepository(ctx, Coupon).findOne({
            where: { id: couponId as any },
        });
        if (!coupon) throw new EntityNotFoundError('Coupon', couponId);
        if (!coupon.isActive) throw new UserInputError('Coupon is not active');

        const now = new Date();
        if (now < coupon.startAt || now > coupon.endAt) {
            throw new UserInputError('Coupon is not within active period');
        }
        if (coupon.claimedCount >= coupon.totalQuantity) {
            throw new UserInputError('Coupon out of stock');
        }

        const claimedRepo = this.connection.getRepository(ctx, CouponCode);
        const claimedByUser = await claimedRepo.count({
            where: { couponId: Number(coupon.id), customerId: Number(customer.id) },
        });
        if (claimedByUser >= coupon.limitPerUser) {
            throw new UserInputError('Claim limit reached for this user');
        }

        if (coupon.isNewUserOnly) {
            const isNew = await this.isNewCustomer(ctx, customer.id);
            if (!isNew) throw new UserInputError('Coupon is for new users only');
        }

        await this.connection.startTransaction(ctx);
        try {
            const couponRepo = this.connection.getRepository(ctx, Coupon);
            const lockedCoupon = await couponRepo
                .createQueryBuilder('coupon')
                .setLock('pessimistic_write')
                .where('coupon.id = :id', { id: coupon.id })
                .getOne();
            if (!lockedCoupon) throw new EntityNotFoundError('Coupon', couponId);
            if (lockedCoupon.claimedCount >= lockedCoupon.totalQuantity) {
                throw new UserInputError('Coupon out of stock');
            }
            lockedCoupon.claimedCount += 1;
            await couponRepo.save(lockedCoupon);

            const code = new CouponCode({
                couponId: Number(coupon.id),
                customerId: Number(customer.id),
                code: this.generateCode(),
                status: CouponCodeStatus.Unused,
                claimedAt: now,
            });
            code.channels = [ctx.channel];
            const saved = await claimedRepo.save(code);

            await this.connection.commitOpenTransaction(ctx);
            return saved;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    async getMyCoupons(
        ctx: RequestContext,
        status?: string,
    ): Promise<CouponCode[]> {
        if (!ctx.activeUserId) throw new UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) return [];

        const repo = this.connection.getRepository(ctx, CouponCode);
        const where: any = { customerId: customer.id };
        if (status) where.status = status;
        return repo.find({ where });
    }

    /** 校验券码可用性并计算折扣金额（不修改状态）。 */
    async validateCoupon(
        ctx: RequestContext,
        code: string,
        orderLines: CouponOrderLineInput[],
    ): Promise<CouponValidationResult> {
        const couponCode = await this.connection
            .getRepository(ctx, CouponCode)
            .findOne({ where: { code }, relations: [] });
        if (!couponCode) {
            return { valid: false, discountAmount: 0, error: 'Coupon code not found' };
        }
        if (couponCode.status !== CouponCodeStatus.Unused) {
            return { valid: false, discountAmount: 0, error: `Coupon is ${couponCode.status}` };
        }

        const coupon = await this.connection
            .getRepository(ctx, Coupon)
            .findOne({ where: { id: couponCode.couponId } });
        if (!coupon) {
            return { valid: false, discountAmount: 0, error: 'Coupon not found' };
        }
        if (!coupon.isActive) {
            return { valid: false, discountAmount: 0, error: 'Coupon is inactive' };
        }
        const now = new Date();
        if (now < coupon.startAt || now > coupon.endAt) {
            return { valid: false, discountAmount: 0, error: 'Coupon is out of active period' };
        }

        const orderSubtotal = orderLines.reduce((sum, l) => sum + l.lineTotal, 0);
        if (coupon.minSpend > 0 && orderSubtotal < coupon.minSpend) {
            return {
                valid: false,
                discountAmount: 0,
                error: `Order amount does not meet minSpend ${coupon.minSpend}`,
            };
        }

        const eligibleTotal = this.computeEligibleTotal(coupon, orderLines);
        if (eligibleTotal <= 0) {
            return { valid: false, discountAmount: 0, error: 'No eligible items in order' };
        }

        const discountAmount = this.computeDiscount(coupon, eligibleTotal);
        return { valid: true, discountAmount, error: null };
    }

    /** 核销：事务化，校验 + 标记 used。 */
    async redeemCoupon(ctx: RequestContext, code: string, orderId: ID): Promise<CouponCode> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.collections',
        ]);
        if (!order) throw new EntityNotFoundError('Order', orderId);

        const orderLines = this.mapOrderToLines(order);
        const result = await this.validateCoupon(ctx, code, orderLines);
        if (!result.valid) {
            throw new UserInputError(result.error ?? 'Coupon is not valid');
        }

        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, CouponCode);
            const locked = await repo
                .createQueryBuilder('cc')
                .setLock('pessimistic_write')
                .where('cc.code = :code', { code })
                .getOne();
            if (!locked) throw new EntityNotFoundError('CouponCode', code);
            if (locked.status !== CouponCodeStatus.Unused) {
                throw new UserInputError(`Coupon is ${locked.status}`);
            }
            locked.status = CouponCodeStatus.Used;
            locked.usedAt = new Date();
            locked.orderId = Number(orderId);
            const saved = await repo.save(locked);

            await this.connection.commitOpenTransaction(ctx);
            Logger.info(
                `Coupon ${code} redeemed for order ${orderId}, discount=${result.discountAmount}`,
                loggerCtx,
            );
            return saved;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    /** 释放：订单取消时归还券码。 */
    async releaseCoupon(ctx: RequestContext, code: string): Promise<CouponCode> {
        const repo = this.connection.getRepository(ctx, CouponCode);
        const couponCode = await repo.findOne({ where: { code } });
        if (!couponCode) throw new EntityNotFoundError('CouponCode', code);
        if (couponCode.status !== CouponCodeStatus.Used) return couponCode;

        couponCode.status = CouponCodeStatus.Unused;
        couponCode.usedAt = null;
        couponCode.orderId = null;
        const saved = await repo.save(couponCode);
        Logger.info(`Coupon ${code} released`, loggerCtx);
        return saved;
    }

    // ===== Promotion 桥接 =====

    /**
     * 将券码绑定到订单（设置 order.customFields.appliedCouponCode）。
     * 调用后，couponOrderAction 会在订单计算时自动应用折扣。
     * 不修改券码状态——状态变更由 OrderPlacedEvent 触发 redeemCoupon 完成。
     */
    async applyCouponToOrder(
        ctx: RequestContext,
        orderId: ID,
        code: string,
    ): Promise<CouponValidationResult> {
        const orderLines = await this.getOrderLinesForCoupon(ctx, orderId);
        const result = await this.validateCoupon(ctx, code, orderLines);
        if (!result.valid) {
            return result;
        }
        await this.orderService.updateCustomFields(ctx, orderId, { appliedCouponCode: code });
        return result;
    }

    /** 订单取消时清除绑定的券码并释放券码。 */
    async releaseCouponOnOrder(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) return;
        const code = (order as any).customFields?.appliedCouponCode;
        if (!code) return;
        try {
            await this.releaseCoupon(ctx, code);
            await this.orderService.updateCustomFields(ctx, orderId, { appliedCouponCode: null });
        } catch (e: any) {
            Logger.error(`Failed to release coupon ${code} for order ${orderId}: ${e?.message ?? e}`, loggerCtx);
        }
    }

    // ===== Scheduled: expire =====

    /** 过期所有 unused 且对应券已过 endAt 的券码。 */
    async expireCoupons(ctx: RequestContext): Promise<number> {
        const codeRepo = this.connection.getRepository(ctx, CouponCode);
        const couponRepo = this.connection.getRepository(ctx, Coupon);
        const now = new Date();

        const expiredCoupons = await couponRepo
            .createQueryBuilder('coupon')
            .select(['coupon.id'])
            .where('coupon.endAt < :now', { now })
            .getMany();
        if (expiredCoupons.length === 0) return 0;
        const expiredCouponIds = expiredCoupons.map(c => c.id);

        const result = await codeRepo
            .createQueryBuilder()
            .update(CouponCode)
            .set({ status: CouponCodeStatus.Expired })
            .where('status = :status', { status: CouponCodeStatus.Unused })
            .andWhere('couponId IN (:...ids)', { ids: expiredCouponIds })
            .execute();

        const affected = result.affected ?? 0;
        if (affected > 0) {
            Logger.info(`Expired ${affected} coupon codes`, loggerCtx);
        }
        return affected;
    }

    // ===== Helpers =====

    /** 将订单行映射为券校验所需的简化结构。供 resolver 与 redeemCoupon 复用。 */
    async getOrderLinesForCoupon(
        ctx: RequestContext,
        orderId: ID,
    ): Promise<CouponOrderLineInput[]> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.collections',
        ]);
        if (!order) throw new EntityNotFoundError('Order', orderId);
        return this.mapOrderToLines(order);
    }

    private mapOrderToLines(order: Order): CouponOrderLineInput[] {
        return (order.lines ?? []).map(line => ({
            productId: Number(line.productVariant?.productId ?? 0),
            variantId: Number(line.productVariantId ?? 0),
            quantity: line.quantity ?? 0,
            lineTotal: line.linePrice ?? 0,
            collectionIds: (line.productVariant?.collections ?? []).map(c => Number(c.id)),
        }));
    }

    private computeEligibleTotal(coupon: Coupon, orderLines: CouponOrderLineInput[]): number {
        const productFilter =
            coupon.applicableProductIds && coupon.applicableProductIds.length > 0
                ? new Set(coupon.applicableProductIds)
                : null;
        const categoryFilter =
            coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0
                ? new Set(coupon.applicableCategoryIds)
                : null;

        return orderLines
            .filter(line => {
                if (productFilter && !productFilter.has(line.productId)) return false;
                if (categoryFilter) {
                    const hit = line.collectionIds.some(id => categoryFilter.has(id));
                    if (!hit) return false;
                }
                return true;
            })
            .reduce((sum, line) => sum + line.lineTotal, 0);
    }

    private computeDiscount(coupon: Coupon, eligibleTotal: number): number {
        let discount = 0;
        if (coupon.couponType === 'fixed') {
            discount = coupon.discountValue;
        } else if (coupon.couponType === 'percentage') {
            discount = Math.floor((eligibleTotal * coupon.discountValue) / 100);
        }
        if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
        }
        if (discount > eligibleTotal) {
            discount = eligibleTotal;
        }
        return Math.max(0, discount);
    }

    private generateCode(): string {
        return randomBytes(6).toString('hex').toUpperCase();
    }

    private async isNewCustomer(ctx: RequestContext, customerId: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, Order);
        const count = await repo
            .createQueryBuilder('order')
            .leftJoin('order.customer', 'customer')
            .where('customer.id = :customerId', { customerId })
            .andWhere('order.state NOT IN (:...states)', { states: NON_PLACED_STATES })
            .getCount();
        return count === 0;
    }
}
