import { Injectable } from '@nestjs/common';
import {
    Administrator,
    Customer,
    CustomerService,
    I18nError,
    ID,
    Injector,
    ListQueryBuilder,
    ListQueryOptions,
    LogLevel,
    Logger,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';

import { COUPON_NOT_OWNED, loggerCtx } from './constants';
import { localizeText } from './localize';
import { isDefaultMallChannel, lineHasShopId } from './coupon-scope';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

/** 模板 update() 允许写入的字段白名单 */
const TEMPLATE_UPDATE_ALLOWED: ReadonlyArray<keyof CouponTemplate> = [
    'name',
    'description',
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

/**
 * 属店权限不足错误。本版本 Vendure 的 ForbiddenError 构造器固定 message='error.forbidden'（code='FORBIDDEN'），
 * 无法注入自定义文案；故继承 I18nError，沿用 FORBIDDEN 错误码，以显式携带 COUPON_NOT_OWNED 语义消息。
 */
export class CouponNotOwnedError extends I18nError {
    constructor() {
        super(COUPON_NOT_OWNED, {}, 'FORBIDDEN', LogLevel.Warn);
    }
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
        const qb = this.listQueryBuilder.build(CouponTemplate, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        });
        // 属店隔离：店主管理员只能看到「平台级券（shopId 为空）」+「本店发的券」；
        // 超级管理员（无属店）→ 全量。
        const adminShopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
        if (adminShopId != null) {
            qb.andWhere('(coupontemplate.shopId IS NULL OR coupontemplate.shopId = :adminShopId)', {
                adminShopId,
            });
        }
        return qb
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOneTemplate(ctx: RequestContext, id: ID): Promise<CouponTemplate | undefined> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await repo.findOne({
            where: { id: id as any },
            relations: { channels: true },
        });
        if (tpl) {
            await this.assertManagedByShop(ctx, tpl.shopId);
        }
        return tpl ?? undefined;
    }

    async createTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = new CouponTemplate(input);
        if (tpl.type === 'FULL') {
            tpl.minSpend = 0;
        }
        tpl.channels = [ctx.channel];
        tpl.claimedCount = 0;
        // 发行归属店铺（跨渠道范围用）：优先采用显式传入的 shopId，否则从当前管理员的店解析。
        // 若 Shop / Administrator 依赖插件未注册或无法解析，则保持 undefined（不阻断）。
        if (input.shopId != null) {
            (tpl as any).shopId = Number(input.shopId);
        } else if (tpl.shopId == null) {
            const shopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
            if (shopId != null) {
                (tpl as any).shopId = Number(shopId);
            }
        }
        return repo.save(tpl);
    }

    async updateTemplate(ctx: RequestContext, input: any): Promise<CouponTemplate> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new UserInputError(`CouponTemplate with id ${input.id} not found`);
        }
        await this.assertManagedByShop(ctx, tpl.shopId);
        for (const key of TEMPLATE_UPDATE_ALLOWED) {
            if (key in input) {
                (tpl as any)[key] = input[key];
            }
        }
        return repo.save(tpl);
    }

    async deleteTemplate(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (tpl) {
            await this.assertManagedByShop(ctx, tpl.shopId);
        }
        await repo.delete(id);
    }

    /* ------------------------- 领券中心 / 券包 ------------------------- */

    async couponCentre(ctx: RequestContext): Promise<CouponTemplate[]> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const now = new Date();
        const own = await repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
        // 非默认商城维持现状：仅列出本渠道券。
        if (!isDefaultMallChannel(ctx)) {
            return own;
        }
        // 默认商城：除本渠道券外，追加列出「其 shopId 对应商品出现在本商城」的租户券。
        const shopIds = await this.shopIdsPresentInChannel(ctx);
        if (shopIds.size === 0) {
            return own;
        }
        const extra = await repo
            .createQueryBuilder('tpl')
            .where('tpl.shopId IN (:...shopIds)', { shopIds: [...shopIds] })
            .andWhere('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
        const ownIds = new Set(own.map(t => String(t.id)));
        return [...own, ...extra.filter(t => !ownIds.has(String(t.id)))];
    }

    /** 默认商城渠道下，本商城商品（Product.customFields.shopId）中出现过的店铺 id 集合。 */
    private async shopIdsPresentInChannel(ctx: RequestContext): Promise<Set<number>> {
        const set = new Set<number>();
        try {
            const productRepo = this.connection.getRepository(ctx, Product);
            const products = await productRepo.find({ relations: { channels: true } });
            for (const p of products) {
                const inChannel = ((p as any).channels ?? []).some(
                    (c: any) => String(c.id) === String(ctx.channelId),
                );
                if (!inChannel) continue;
                const sid = Number(((p.customFields as any) ?? {}).shopId);
                if (sid && !Number.isNaN(sid)) set.add(sid);
            }
        } catch {
            // Product 不可用等场景忽略，仅返回本渠道券
        }
        return set;
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
            `积分兑换优惠券:${localizeText(tpl.name as any, ctx.languageCode, '')}`,
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

    /* ------------------------- 定向发券（批量 + 通知） ------------------------- */

    public async listChannelCustomers(
        ctx: RequestContext,
        query?: string,
        take = 20,
        skip = 0,
    ): Promise<{ items: Customer[]; totalItems: number }> {
        const repo = this.connection.getRepository(ctx, Customer);
        const qb = repo
            .createQueryBuilder('c')
            .select([
                'c.id',
                'c.emailAddress',
                'c.firstName',
                'c.lastName',
                'c.phoneNumber',
                'c.createdAt',
            ])
            .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId });
        if (query) {
            const q = `%${query.trim().toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(c.emailAddress) LIKE :q OR LOWER(c.firstName) LIKE :q OR LOWER(c.lastName) LIKE :q OR LOWER(c.phoneNumber) LIKE :q)',
                { q },
            );
        }
        qb.orderBy('c.id', 'DESC').skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    private async customerInChannel(ctx: RequestContext, customerId: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, Customer);
        const count = await repo
            .createQueryBuilder('c')
            .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('c.id = :id', { id: customerId })
            .getCount();
        return count > 0;
    }

    private async notifyCouponIssued(
        ctx: RequestContext,
        customerId: ID,
        tpl: CouponTemplate,
        code: string,
    ): Promise<void> {
        // 复用 message-plugin 的 Message/MessageDelivery（invoice-plugin 已落地范式）；
        // 未装 message-plugin 时实体不存在，抛错由调用方捕获、不阻塞发券。
        const msgRepo = this.connection.getRepository(ctx, 'Message' as any);
        const delRepo = this.connection.getRepository(ctx, 'MessageDelivery' as any);
        const name = localizeText((tpl as any).name, ctx.languageCode, '优惠券');
        const title = `优惠券到账：${name}`;
        const body = `您获得本店定向赠送优惠券，券码 ${code}，可在结算时抵扣。`;
        const message = await msgRepo.save(
            msgRepo.create({
                title,
                body,
                deliveryChannel: 'inapp',
                audienceType: 'all',
                status: 'sent',
                totalTarget: 1,
                totalSent: 1,
                channels: [ctx.channel],
            }),
        );
        await delRepo.save(
            delRepo.create({
                messageId: message.id,
                customerId: Number(customerId),
                deliveryStatus: 'sent',
                channels: [ctx.channel],
            }),
        );
    }

    public async grantCouponIssue(
        ctx: RequestContext,
        templateId: ID,
        customerIds: ID[],
        notify: boolean,
    ): Promise<Array<{ customerId: ID; ok: boolean; code: string | null; reason: string | null }>> {
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const customerRepo = this.connection.getRepository(ctx, Customer);
        const results: Array<{ customerId: ID; ok: boolean; code: string | null; reason: string | null }> = [];
        for (const customerId of customerIds) {
            try {
                const cust = await customerRepo.findOne({
                    where: { id: customerId as any },
                    relations: { user: true },
                });
                if (!cust) {
                    results.push({ customerId, ok: false, code: null, reason: 'CUSTOMER_NOT_FOUND' });
                    continue;
                }
                if (!(await this.customerInChannel(ctx, customerId))) {
                    results.push({ customerId, ok: false, code: null, reason: 'CUSTOMER_NOT_IN_CHANNEL' });
                    continue;
                }
                if (tpl.perUserLimit > 0) {
                    const owned = await this.countHeld(Number(customerId), tpl.id);
                    if (owned >= tpl.perUserLimit) {
                        results.push({ customerId, ok: false, code: null, reason: 'PER_USER_LIMIT' });
                        continue;
                    }
                }
                const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
                if (!ok) {
                    results.push({ customerId, ok: false, code: null, reason: 'SOLD_OUT' });
                    continue;
                }
                const cc = await this.createUserCoupon(ctx, Number(customerId), tpl, 'ADMIN');
                results.push({ customerId, ok: true, code: cc.code, reason: null });
                if (notify) {
                    try {
                        await this.notifyCouponIssued(ctx, customerId, tpl, cc.code);
                    } catch (e: any) {
                        Logger.warn(
                            `notifyCouponIssued failed for ${customerId}: ${e?.message ?? e}`,
                            loggerCtx,
                        );
                    }
                }
            } catch (e: any) {
                results.push({ customerId, ok: false, code: null, reason: 'ERROR' });
            }
        }
        return results;
    }

    async revokeCoupon(ctx: RequestContext, id: ID): Promise<CustomerCoupon> {
        const repo = this.connection.getRepository(ctx, CustomerCoupon);
        const cc = await repo.findOne({ where: { id: id as any }, relations: { template: true } });
        if (!cc) {
            throw new UserInputError(`CustomerCoupon ${id} not found`);
        }
        // 属店隔离：revoke 针对券实例，按其所关联券模板的发行店校验归属。
        await this.assertManagedByShop(ctx, cc.template?.shopId);
        if (cc.status === 'UNUSED') {
            cc.status = 'INVALID';
            await repo.save(cc);
        }
        return cc;
    }

    /* ------------------------- 结算选券 / 清券 ------------------------- */

    async applyCouponToOrder(ctx: RequestContext, orderId: ID, code: string): Promise<any> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'customer.user',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ] as any);
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
        // 跨渠道范围校验 + 本店商品行基数（默认商城：仅本店行参与门槛/折扣；非默认商城整单）。
        const tplShopId = tpl.shopId as number | undefined;
        const lines = ((order as any)?.lines ?? []) as any[];
        const eligibleLines = isDefaultMallChannel(ctx)
            ? lines.filter(l => lineHasShopId(l, tplShopId))
            : lines;
        if (isDefaultMallChannel(ctx) && eligibleLines.length === 0) {
            throw new UserInputError('COUPON_SCOPE_MISMATCH');
        }
        const base = (ctx.channel.pricesIncludeTax
            ? eligibleLines.reduce((s: number, l: any) => s + (l.linePriceWithTax ?? 0), 0)
            : eligibleLines.reduce((s: number, l: any) => s + (l.linePrice ?? 0), 0));
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
        // 确保传给 promotions 重算的订单在其 OrderLine 上带 productVariant.product，
        // 以便 coupon_applied 条件读取 Product.customFields.shopId 做行级范围判定。
        for (const line of (updatedOrder as any)?.lines ?? []) {
            const matched = (lines ?? []).find(l => String(l.id) === String(line.id));
            if (matched && (line.productVariant == null || !line.productVariant.product)) {
                line.productVariant = matched.productVariant;
            }
        }
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

    /**
     * 归属解析：activeUserId → Administrator.user → Shop.administratorId（与 shop-plugin 同法，不依赖 ctx.channelId）。
     * 若连接未注册 Shop 实体（shop-plugin 未加载）或 admin 无法解析，则回退为 undefined（不阻断）。
     *
     * 公开（public）：供 CouponAdminResolver 等鉴权调用点复用，避免在 service 内重复实现。
     * 保持签名兼容，Task B 既有的私有调用不受影响。
     */
    public async resolveShopIdFromActiveUser(
        ctx: RequestContext,
        userId?: ID,
    ): Promise<number | undefined> {
        try {
            if (userId == null) return undefined;
            const adminRepo = this.connection.getRepository(ctx, Administrator);
            const admin = await adminRepo.findOne({
                where: { user: { id: userId } } as any,
                select: { id: true },
            });
            if (!admin || admin.id == null) return undefined;
            const ShopClass = this.findEntityClass('Shop');
            if (!ShopClass) return undefined;
            const shopRepo = (this.connection.getRepository(ctx, ShopClass) as any);
            const shop = await shopRepo.findOne({ where: { administratorId: admin.id } });
            return shop?.id as number | undefined;
        } catch {
            // Shop / Administrator 等可选依赖未注册或查询失败 → 保持未设 shopId
            return undefined;
        }
    }

    /**
     * 原则：超级管理员（无属店 Shop）可管理全部券；属店管理员只能管理「平台级券（shopId 为空）
     * + 本店发行的券」，其余一率抛 ForbiddenError(COUPON_NOT_OWNED)。
     * 供 resolver 与列表过滤复用。
     */
    public async assertManagedByShop(ctx: RequestContext, targetShopId?: number): Promise<void> {
        const adminShopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
        // 当前管理员无属店（超级管理员）→ 全量允许
        if (adminShopId == null) return;
        const target = targetShopId != null ? Number(targetShopId) : undefined;
        // 目标券无属店（平台级券）→ 允许本地化运营管理；本店券 → 允许；他店券 → 拒绝。
        if (target != null && target !== adminShopId) {
            throw new CouponNotOwnedError();
        }
    }

    /** 按实体名称从连接元数据中取回实体类（用于在插件未直接依赖 Shop 时安全解析）。 */
    public findEntityClass(name: string): any | undefined {
        try {
            const meta = this.connection.rawConnection.entityMetadatas.find(m => m.name === name);
            return meta ? meta.target : undefined;
        } catch {
            return undefined;
        }
    }

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