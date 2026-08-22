import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';

import { loggerCtx } from './constants';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

/** 模板 update() 允许写入的字段白名单 */
const TEMPLATE_UPDATE_ALLOWED: ReadonlyArray<keyof CouponTemplate> = [
    'name',
    'type',
    'discountValue',
    'minSpend',
    'startsAt',
    'endsAt',
    'totalCount',
    'pointsPrice',
    'perUserLimit',
    'scope',
    'categoryId',
    'variantId',
    'enabled',
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(prefix: string): string {
    const seg = (n: number) =>
        Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    return `${prefix}-${seg(4)}-${seg(4)}`;
}

@Injectable()
export class CouponService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    private orderService!: OrderService;
    private customerService!: CustomerService;
    private memberLevelService!: MemberLevelService;
    private codePrefix = 'C';

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        this.customerService = injector.get(CustomerService);
        try {
            this.memberLevelService = injector.get(MemberLevelService);
        } catch {
            // member-level-plugin 未注册则禁用积分兑换
            this.memberLevelService = null as any;
        }
        try {
            const opts = injector.get('COUPON_PLUGIN_OPTIONS' as any) as { codePrefix?: string } | undefined;
            if (opts?.codePrefix) {
                this.codePrefix = opts.codePrefix;
            }
        } catch {
            // options not injected
        }
    }

    /* ------------------------- 模板管理 ------------------------- */

    async findAllTemplates(
        ctx: RequestContext,
        options?: ListQueryOptions<CouponTemplate>,
    ): Promise<{ items: CouponTemplate[]; totalItems: number }> {
        return this.listQueryBuilder
            .build(CouponTemplate, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOneTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        return (
            (await repo.findOne({
                where: { id: id as any },
                relations: { channels: true },
            })) ?? undefined
        );
    }

    async createTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = new CouponTemplate(input);
        if (tpl.type === 'FULL') {
            tpl.minSpend = 0;
        }
        tpl.channels = [ctx.channel];
        tpl.claimedCount = 0;
        return repo.save(tpl);
    }

    async updateTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new UserInputError(`CouponTemplate with id ${input.id} not found`);
        }
        for (const key of TEMPLATE_UPDATE_ALLOWED) {
            if (key in input) {
                (tpl as any)[key] = input[key];
            }
        }
        return repo.save(tpl);
    }

    async deleteTemplate(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        await repo.delete(id);
    }

    /* ------------------------- 领券中心 / 券包 ------------------------- */

    async couponCentre(ctx: RequestContext): Promise<CouponTemplate[]> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const now = new Date();
        return repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
    }

    async listMyCoupons(ctx: RequestContext, status?: string): Promise<CustomerCoupon[]> {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) return [];
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        const qb = repo
            .createQueryBuilder('cc')
            .leftJoinAndSelect('cc.template', 'template')
            .where('cc.customerId = :customerId', { customerId });
        if (status) {
            qb.andWhere('cc.status = :status', { status });
        }
        return qb.getMany();
    }

    async listAllCoupons(
        ctx: RequestContext,
        options?: ListQueryOptions<CustomerCoupon>,
    ): Promise<{ items: CustomerCoupon[]; totalItems: number }> {
        return this.listQueryBuilder
            .build(CustomerCoupon, options, {
                ctx,
                relations: ['template'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    /* ------------------------- 积分兑换商城 ------------------------- */

    async pointsMallTemplates(ctx: RequestContext): Promise<CouponTemplate[]> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const now = new Date();
        return repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('tpl.pointsPrice > 0')
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .orderBy('tpl.pointsPrice', 'ASC')
            .getMany();
    }

    async exchangeWithPoints(
        ctx: RequestContext,
        templateId: ID,
    ): Promise<{ coupon: CustomerCoupon; spentPoints: number }> {
        if (!this.memberLevelService) {
            throw new UserInputError('Points service is not enabled');
        }
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            throw new UserInputError('No customer for the current user');
        }
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        if (tpl.pointsPrice <= 0) {
            throw new UserInputError('This coupon is not exchangeable with points');
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new UserInputError('Not yet started');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new UserInputError('Coupon redeemed');
        }
        // 限兑校验
        if (tpl.perUserLimit > 0) {
            const owned = await this.countHeld(customerId, tpl.id);
            if (owned >= tpl.perUserLimit) {
                throw new UserInputError('Per-user redemption limit reached');
            }
        }
        // 扣积分（原子 + SPEND 流水；不足抛 Insufficient；Transaction 保证与发券同回滚）
        await this.memberLevelService.spendPoints(
            ctx,
            customerId,
            tpl.pointsPrice,
            null,
            `积分兑换优惠券:${tpl.name}`,
        );
        // 原子扣发行余量（防超发）
        const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
        if (!ok) {
            throw new UserInputError('Coupon sold out');
        }
        const coupon = await this.createUserCoupon(ctx, customerId, tpl, 'EXCHANGE');
        return { coupon, spentPoints: tpl.pointsPrice };
    }

    /* ------------------------- 领券 / 定向发券 ------------------------- */

    async claimCoupon(ctx: RequestContext, templateId: ID): Promise<CustomerCoupon> {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            throw new UserInputError('No customer for the current user');
        }
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await repo.findOne({
            where: { id: templateId as any },
            relations: { channels: true },
        });
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new UserInputError('Coupon not yet started');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new UserInputError('Coupon has expired');
        }
        // 限领校验
        if (tpl.perUserLimit > 0) {
            const owned = await this.countHeld(customerId, tpl.id);
            if (owned >= tpl.perUserLimit) {
                throw new UserInputError('Per-user coupon limit reached');
            }
        }
        // 原子扣减发行余量（防超发）
        const claim = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
        if (!claim) {
            throw new UserInputError('Coupon sold out');
        }
        return this.createUserCoupon(ctx, customerId, tpl, 'CENTRE');
    }

    async grantCoupon(ctx: RequestContext, templateId: ID, customerIds: ID[]): Promise<string[]> {
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const codes: string[] = [];
        for (const customerId of customerIds) {
            const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
            if (!ok) {
                throw new UserInputError('Coupon sold out');
            }
            const cc = await this.createUserCoupon(ctx, customerId as number, tpl, 'ADMIN');
            codes.push(cc.code);
        }
        return codes;
    }

    async revokeCoupon(ctx: RequestContext, id: ID): Promise<CustomerCoupon> {
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        const cc = await repo.findOne({ where: { id: id as any } });
        if (!cc) {
            throw new UserInputError(`CustomerCoupon ${id} not found`);
        }
        if (cc.status === 'UNUSED') {
            cc.status = 'INVALID';
            await repo.save(cc);
        }
        return cc;
    }

    /* ------------------------- 结算选券 / 清券 ------------------------- */

    async applyCouponToOrder(ctx: RequestContext, orderId: ID, code: string): Promise<any> {
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }
        // 归属校验：order.customer.user.id === ctx.activeUserId（勿用 customer.id）
        if ((order as any)?.customer?.user?.id !== ctx.activeUserId) {
            throw new UserInputError('You can only apply coupons to your own order');
        }
        const customerId = (order as any)?.customer?.id as number | undefined;
        if (!customerId) {
            throw new UserInputError('Order has no customer');
        }

        const ccRepo = this.connection.getRepository(ctx, CustomerCoupon);
        const cc = await ccRepo.findOne({
            where: { code } as any,
            relations: { template: true },
        });
        if (!cc || cc.customerId !== customerId) {
            throw new UserInputError('Coupon not found or does not belong to you');
        }
        // UNUSED / RETURNED（取消回退后可复用）可被选定
        if (cc.status !== 'UNUSED' && cc.status !== 'RETURNED') {
            throw new UserInputError('Coupon is not in a usable state');
        }
        const tpl = cc.template;
        if (!tpl) {
            throw new UserInputError('Coupon template not found');
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new UserInputError('Coupon not yet active');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new UserInputError('Coupon has expired');
        }
        const base = ctx.channel.pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        if (tpl.minSpend > base) {
            throw new UserInputError(
                `Order total below minimum spend of ${tpl.minSpend} for this coupon`,
            );
        }

        // 一单一券：先清旧再覆写，随后重算 promotions
        const updatedOrder = await this.orderService.updateCustomFields(ctx, orderId, {
            couponCode: cc.code,
            couponId: cc.id,
        });
        return this.orderService.applyPriceAdjustments(ctx, updatedOrder);
    }

    async clearCouponFromOrder(ctx: RequestContext, orderId: ID): Promise<any> {
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }
        if ((order as any)?.customer?.user?.id !== ctx.activeUserId) {
            throw new UserInputError('You can only clear coupons on your own order');
        }
        const updatedOrder = await this.orderService.updateCustomFields(ctx, orderId, {
            couponCode: null,
            couponId: null,
        });
        return this.orderService.applyPriceAdjustments(ctx, updatedOrder);
    }

    /* ------------------------- 销核 / 回退（事件触发） ------------------------- */

    /** 支付成功后核销券 */
    async bindAsUsed(ctx: RequestContext, orderId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        const code = await this.orderCode(ctx, orderId);
        if (!code) return;
        const cc = await repo.findOne({ where: { code } as any });
        if (!cc || cc.status !== 'UNUSED') return;
        cc.status = 'USED';
        cc.usedOrderId = orderId;
        cc.usedAt = new Date();
        await repo.save(cc);
        Logger.info(`Coupon ${code} marked as USED on order ${orderId}`, loggerCtx);
    }

    /** 订单取消回退券（可复用） */
    async returnCoupon(ctx: RequestContext, orderId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        const code = await this.orderCode(ctx, orderId);
        if (!code) return;
        const cc = await repo.findOne({ where: { code } as any });
        if (!cc || cc.status !== 'USED') return;
        if (String(cc.usedOrderId) !== String(orderId)) return; // 幂等
        cc.status = 'RETURNED';
        // TypeORM 对 undefined 不作为变更持久化，清理可空列必须显式置 null
        cc.usedOrderId = null as any;
        cc.usedAt = null as any;
        await repo.save(cc);
        Logger.info(`Coupon ${code} returned on order ${orderId} cancellation`, loggerCtx);
    }

    /* ------------------------- 私有工具 ------------------------- */

    private async orderCode(_ctx: RequestContext, orderId: ID): Promise<string | undefined> {
        // 用户券销核/回退时，从订单 customFields 读券码
        const order = await this.orderService.findOne(_ctx, orderId);
        return (order as any)?.customFields?.couponCode ?? undefined;
    }

    private async currentCustomerId(ctx: RequestContext): Promise<number | undefined> {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId!);
        return customer?.id as number | undefined;
    }

    private async countHeld(customerId: number, templateId: ID): Promise<number> {
        // 未跑在具体 ctx 内，用原始连接
        const countRepo = this.connection.rawConnection.getRepository(CustomerCoupon);
        return countRepo
            .createQueryBuilder('cc')
            .where('cc.customerId = :customerId', { customerId })
            .andWhere('cc.templateId = :templateId', { templateId: templateId as any })
            .andWhere("cc.status NOT IN ('RETURNED','INVALID','EXPIRED')")
            .getCount();
    }

    /** 原子扣减发行余量；受影响数大于 0 表示成功 */
    private async atomicIncrementClaimed(
        ctx: RequestContext,
        templateId: ID,
        tpl: CouponTemplate,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ claimedCount: () => 'claimedCount + 1' })
            .where(
                'id = :id AND (totalCount = 0 OR claimedCount < totalCount)',
                { id: templateId as any },
            )
            .execute();
        return (result.affected ?? 0) > 0;
    }

    private async createUserCoupon(
        ctx: RequestContext,
        customerId: number,
        tpl: CouponTemplate,
        issuedBy: 'CENTRE' | 'ADMIN' | 'EXCHANGE',
    ): Promise<CustomerCoupon> {
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        // 重试兜底唯一码冲突（碰撞概率极低）
        for (let attempt = 0; attempt < 3; attempt++) {
            const code = generateCode(this.codePrefix);
            const cc = new CustomerCoupon({
                customerId,
                templateId: tpl.id as number,
                code,
                status: 'UNUSED',
                issuedBy,
                issuedAt: new Date(),
                expiredAt: tpl.endsAt ?? undefined,
            });
            try {
                return await repo.save(cc);
            } catch (e: any) {
                if (String(e?.message ?? '').includes('unique')) continue;
                throw e;
            }
        }
        throw new UserInputError('Failed to generate a unique coupon code');
    }
}