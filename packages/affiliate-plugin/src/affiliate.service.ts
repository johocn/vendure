import { Inject, Injectable } from '@nestjs/common';
import {
    AdministratorService,
    Customer,
    EntityNotFoundError,
    ForbiddenError,
    ID,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';

import { AFFILIATE_DEFAULT_LOAD_ON, AFFILIATE_DEFAULT_RATE, AFFILIATE_PLUGIN_OPTIONS, AffiliatePluginOptions } from './affiliate.options';
import { Affiliate, AffiliateStatus } from './affiliate.entity';
import { AffiliateRelation, BindSource } from './affiliate-relation.entity';
import { AffiliateCommissionEntry } from './affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';

/** 易读字符集（去 0/O/1/I/L 等易混字符）。 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 金额 round(base * rate / 1000)。 */
function round(base: number, rate: number): number {
    return Math.round((base * rate) / 1000);
}

@Injectable()
export class AffiliateService {
    constructor(
        @Inject(AFFILIATE_PLUGIN_OPTIONS) private options: AffiliatePluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private administratorService: AdministratorService,
    ) {}

    // ---------- 店主域鉴权 ----------

    /**
     * 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。
     * 直接仓储查 Shop，勿注入 shop.service（防 DI 环）。
     */
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

    // ---------- C 端身份 ----------

    /** 当前活跃用户对应的 Customer（按 customer.user.id 关联）；非顾客返回 undefined。 */
    async customerOf(ctx: RequestContext): Promise<Customer | undefined> {
        if (!ctx.activeUserId) return undefined;
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } as any });
        return customer ?? undefined;
    }

    // ---------- 推广码 ----------

    /** 生成唯一推广码：时间戳 base36 + 6 位易读随机字符，冲突重试（最多 10 次）。 */
    async genUniqueCode(ctx: RequestContext): Promise<string> {
        const repo = this.connection.getRepository(ctx, Affiliate);
        for (let i = 0; i < 10; i++) {
            const ts = Date.now().toString(36).toUpperCase();
            let rnd = '';
            for (let j = 0; j < 6; j++) {
                rnd += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
            const code = `${ts}${rnd}`;
            const hit = await repo.findOne({ where: { code } });
            if (!hit) return code;
        }
        throw new UserInputError('Failed to generate a unique affiliate code');
    }

    // ---------- 推广员注册 / 绑定 ----------

    /** 成为推广员：同一 userId 已有则报错；生成 code 并初始化状态与余额。 */
    async becomeAffiliate(ctx: RequestContext, shopId?: ID): Promise<Affiliate> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const repo = this.connection.getRepository(ctx, Affiliate);
        const userId = Number(ctx.activeUserId);
        const existing = await repo.findOne({ where: { userId } });
        if (existing) throw new UserInputError('Already an affiliate');
        const affiliate = repo.create({
            channelId: ctx.channelId as number,
            userId,
            shopId: shopId != null ? Number(shopId) : null,
            code: await this.genUniqueCode(ctx),
            status: 'active' as AffiliateStatus,
            totalCommission: 0,
            withdrawableCommission: 0,
        });
        affiliate.channels = [ctx.channel];
        return repo.save(affiliate);
    }

    /** 顾客绑定推广关系：code 查 Affiliate，拦 self-bind，幂等防重复绑定。 */
    async bindRelation(ctx: RequestContext, code: string, source?: 'code' | 'click'): Promise<AffiliateRelation> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerOf(ctx);
        if (!customer) throw new ForbiddenError();
        const bindSource: BindSource = source === 'code' || source === 'click' ? source : 'click';
        const affRepo = this.connection.getRepository(ctx, Affiliate);
        const affiliate = await affRepo.findOne({ where: { code } });
        if (!affiliate) throw new EntityNotFoundError('Affiliate', code);
        if (affiliate.userId === Number(ctx.activeUserId)) {
            throw new UserInputError('Cannot bind to yourself');
        }
        const relRepo = this.connection.getRepository(ctx, AffiliateRelation);
        const existing = await relRepo.findOne({ where: { customerId: customer.id as number } });
        if (existing) throw new UserInputError('Already bound');
        const relation = relRepo.create({
            channelId: ctx.channelId as number,
            affiliateId: affiliate.id as number,
            customerId: customer.id as number,
            bindSource,
            boundAt: new Date(),
        });
        relation.channels = [ctx.channel];
        return relRepo.save(relation);
    }

    // ---------- 佣金 ----------

    /**
     * 幂等生成订单佣金。仅当订单顾客已绑定某 active 推广员、且商品归属店主（shopId 非空）时，
     * 为该行生成佣金项（status pending，loadOn=options.defaultLoadOn）。
     */
    async getOrCreateCommissions(ctx: RequestContext, order: Order): Promise<AffiliateCommissionEntry[]> {
        const orderId = order.id as number;
        const repo = this.connection.getRepository(ctx, AffiliateCommissionEntry);
        const existing = await repo.find({ where: { orderId } });
        if (existing.length > 0) {
            return existing; // 幂等：一单一轮最多生成一次
        }
        const fresh = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.product.translations',
        ]);
        if (!fresh) return [];
        const customerId = fresh.customer?.id as number;
        if (customerId == null) return [];
        const lines = fresh.lines ?? [];
        if (lines.length === 0) return [];

        const relation = await this.connection
            .getRepository(ctx, AffiliateRelation)
            .findOne({ where: { customerId, channelId: ctx.channelId as number } });
        if (!relation) return [];

        const affRepo = this.connection.getRepository(ctx, Affiliate);
        const affiliate = await affRepo.findOne({ where: { id: relation.affiliateId } });
        if (!affiliate || affiliate.status !== 'active') return [];

        const defaultRate = this.options.defaultRate ?? AFFILIATE_DEFAULT_RATE;
        const loadOn = this.options.defaultLoadOn ?? AFFILIATE_DEFAULT_LOAD_ON;
        const entries: AffiliateCommissionEntry[] = [];
        let addedBase = 0;
        let addedCommission = 0;

        for (const line of lines) {
            const product = line.productVariant?.product;
            const cf = (product?.customFields ?? {}) as any;
            const shopIdVal = cf.shopId;
            if (shopIdVal == null) continue; // 未归属店铺的商品不计佣金
            const shopId = Number(shopIdVal);
            const rate = this.resolveRate(cf, defaultRate);
            // core 3.6 OrderLine 无 totalWithTax/税字段：用「含税实际小计（含折扣）」作为成交额基数
            const baseAmount = Number(line.proratedLinePriceWithTax ?? line.linePriceWithTax ?? 0);
            const commissionAmount = round(baseAmount, rate);
            if (commissionAmount <= 0) continue;
            const entry = repo.create({
                channelId: ctx.channelId as number,
                affiliateId: affiliate.id as number,
                customerId,
                orderId,
                orderLineId: line.id as number,
                shopId,
                baseAmount,
                rate,
                commissionAmount,
                loadOn,
                status: 'pending',
            });
            entry.channels = [ctx.channel];
            entries.push(entry);
            addedBase += baseAmount;
            addedCommission += commissionAmount;
        }
        const saved = await repo.save(entries);
        if (saved.length > 0 && addedCommission > 0) {
            // 累计佣金与可提现余额随本单佣金入账（pending 即视为可提现基数），与 rollback/reconcile 保持一致
            affiliate.totalCommission = Number(affiliate.totalCommission ?? 0) + addedCommission;
            affiliate.withdrawableCommission =
                Number(affiliate.withdrawableCommission ?? 0) + addedCommission;
            await affRepo.save(affiliate);
        }
        return saved;
    }

    /** 费率解析：cf.affiliateRate（千分比）优先，否则 defaultRate。 */
    resolveRate(cf: Record<string, unknown>, defaultRate: number): number {
        const custom = Number((cf as any).affiliateRate);
        return Number.isFinite(custom) && custom > 0 ? custom : defaultRate;
    }

    /** 订单退款回滚：该单 pending 佣金置 reversed，并回退对应推广员余额。返回处理条数。 */
    async rollbackCommissions(ctx: RequestContext, orderId: ID): Promise<number> {
        const id = Number(orderId);
        const repo = this.connection.getRepository(ctx, AffiliateCommissionEntry);
        const rows = await repo.find({ where: { orderId: id, status: 'pending' } });
        if (rows.length === 0) return 0;
        const byAffiliate = new Map<number, number>();
        for (const r of rows) {
            r.status = 'reversed';
            byAffiliate.set(r.affiliateId, (byAffiliate.get(r.affiliateId) ?? 0) + r.commissionAmount);
        }
        await repo.save(rows);
        for (const [affiliateId, amount] of byAffiliate) {
            const aff = await this.connection
                .getRepository(ctx, Affiliate)
                .findOne({ where: { id: affiliateId } });
            if (aff) {
                aff.withdrawableCommission = Math.max(
                    0,
                    Number(aff.withdrawableCommission ?? 0) - amount,
                );
                await this.connection.getRepository(ctx, Affiliate).save(aff);
            }
        }
        return rows.length;
    }

    /** 重算可提现余额：pending 佣金总合 - 已支付(pay)提现总合，max(0)。 */
    async reconcileWithdrawable(ctx: RequestContext, affiliateId: ID): Promise<number> {
        const id = Number(affiliateId);
        const commRepo = this.connection.getRepository(ctx, AffiliateCommissionEntry);
        const wdRepo = this.connection.getRepository(ctx, AffiliateWithdrawal);
        const pendingRows = await commRepo.find({ where: { affiliateId: id, status: 'pending' } });
        const paidRows = await wdRepo.find({ where: { affiliateId: id, status: 'paid' } });
        const pendingSum = pendingRows.reduce((s, r) => s + Number(r.commissionAmount ?? 0), 0);
        const paidSum = paidRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
        return Math.max(0, pendingSum - paidSum);
    }

    // ---------- 我（C 端）查询 ----------

    /** 当前用户的推广员档案。 */
    async myAffiliate(ctx: RequestContext): Promise<Affiliate | undefined> {
        if (!ctx.activeUserId) return undefined;
        const aff = await this.connection
            .getRepository(ctx, Affiliate)
            .findOne({ where: { userId: Number(ctx.activeUserId) } });
        return aff ?? undefined;
    }

    /** 当前用户的佣金明细，createdAt DESC。 */
    async myCommissionEntries(ctx: RequestContext): Promise<AffiliateCommissionEntry[]> {
        const aff = await this.myAffiliate(ctx);
        if (!aff) return [];
        return this.connection.getRepository(ctx, AffiliateCommissionEntry).find({
            where: { affiliateId: aff.id as number },
            order: { createdAt: 'DESC' as 'DESC' },
        });
    }

    // ---------- 提现 ----------

    /** 申请提现：校验余额充足后创建 pending 提现单。 */
    async requestWithdrawal(ctx: RequestContext, amount: number): Promise<AffiliateWithdrawal> {
        const aff = await this.myAffiliate(ctx);
        if (!aff) throw new ForbiddenError();
        const available = await this.reconcileWithdrawable(ctx, aff.id as number);
        if (amount > available) {
            throw new UserInputError('exceeds available balance');
        }
        const repo = this.connection.getRepository(ctx, AffiliateWithdrawal);
        const wd = repo.create({
            channelId: ctx.channelId as number,
            affiliateId: aff.id as number,
            amount,
            status: 'pending',
        });
        wd.channels = [ctx.channel];
        return repo.save(wd);
    }

    /** 店主支付提现（幂等：非 pending 直接返回）。 */
    async payWithdrawalSafe(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal> {
        await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, AffiliateWithdrawal);
        const wd = await repo.findOne({ where: { id: Number(id) } });
        if (!wd) throw new EntityNotFoundError('AffiliateWithdrawal', id);
        if (wd.status === 'pending') {
            wd.status = 'paid';
            wd.paidAt = new Date();
            return repo.save(wd);
        }
        return wd; // 幂等：已处理直接返回
    }

    /** 店主拒绝提现（幂等）：pending → 重算回放余额 → rejected。 */
    async rejectWithdrawalSafe(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal> {
        await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, AffiliateWithdrawal);
        const wd = await repo.findOne({ where: { id: Number(id) } });
        if (!wd) throw new EntityNotFoundError('AffiliateWithdrawal', id);
        if (wd.status === 'pending') {
            // 回放余额：拒绝后重算可提现并写回推广员
            const aff = await this.connection
                .getRepository(ctx, Affiliate)
                .findOne({ where: { id: wd.affiliateId } });
            if (aff) {
                aff.withdrawableCommission = await this.reconcileWithdrawable(ctx, wd.affiliateId);
                await this.connection.getRepository(ctx, Affiliate).save(aff);
            }
            wd.status = 'rejected';
            return repo.save(wd);
        }
        return wd; // 幂等：非 pending 直接返回
    }

    // ---------- 管理端列表 ----------

    /** 本 channel 全量推广员。 */
    async affiliates(ctx: RequestContext): Promise<Affiliate[]> {
        return this.connection.getRepository(ctx, Affiliate).find({
            where: { channelId: ctx.channelId as number },
            order: { createdAt: 'DESC' as 'DESC' },
        });
    }

    /** 本 channel 全量提现单。 */
    async withdrawals(ctx: RequestContext): Promise<AffiliateWithdrawal[]> {
        return this.connection.getRepository(ctx, AffiliateWithdrawal).find({
            where: { channelId: ctx.channelId as number },
            order: { createdAt: 'DESC' as 'DESC' },
        });
    }
}