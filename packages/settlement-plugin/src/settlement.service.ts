import { Inject, Injectable } from '@nestjs/common';
import {
    AdministratorService,
    ForbiddenError,
    ID,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { In } from 'typeorm';

import { Shop } from '@vendure/shop-plugin';

import { SETTLEMENT_PLUGIN_OPTIONS } from './constants';
import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { ListOptions, SettlementPluginOptions, SettlementSummary } from './types';

/** 单店聚合结果。 */
interface ShopAggregate {
    shopId: number;
    goodsAmountWithTax: number;
    shippingAmountWithTax: number;
}

/**
 * 商家财务对账编排：订单 completed 口径按店入账 + 提现流转。
 * 店主归属：Shop.administratorId（阶段18 账权），复用 manageOwnShop 权限。
 * 平台操作：@Allow(Permission.UpdateSettings)。
 */
@Injectable()
export class SettlementService {
    constructor(
        @Inject(SETTLEMENT_PLUGIN_OPTIONS) private options: SettlementPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private administratorService: AdministratorService,
    ) {}

    /** 订单完成履结 → 按店入账（幂等：orderId×shopId unique，仅新建明细时累加账户）。 */
    async handleOrderSettled(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ] as any);
        if (!order) {
            return;
        }
        const agg = await this.resolveShopAggregation(ctx, order);
        if (agg.length === 0) {
            return;
        }
        const orderCode = order.code;
        const entryRepo = this.connection.getRepository(ctx, SettlementEntry);
        for (const { shopId, goodsAmountWithTax, shippingAmountWithTax } of agg) {
            const exists = await entryRepo.findOne({
                where: { orderId: Number(orderId), shopId } as any,
            });
            if (exists) {
                // 幂等：已入账，跳过（不重复累加）
                continue;
            }
            const account = await this.getOrCreateAccount(ctx, shopId);
            const rate = account.commissionRate;
            const gross = goodsAmountWithTax + shippingAmountWithTax;
            const commissionAmount = Math.round((gross * rate) / 100);
            const netAmountWithTax = gross - commissionAmount;
            const entry = new SettlementEntry({
                channelId: ctx.channelId as number,
                shopId,
                orderId: Number(orderId),
                orderCode,
                goodsAmountWithTax,
                shippingAmountWithTax,
                commissionAmount,
                netAmountWithTax,
                settledAt: new Date(),
            } as any);
            await entryRepo.save(entry);
            // 账户余额/累计：仅在新建明细后累加一次
            account.availableBalance += netAmountWithTax;
            account.totalGoodsAmount += goodsAmountWithTax;
            account.totalShippingAmount += shippingAmountWithTax;
            account.totalCommission += commissionAmount;
            await this.connection.getRepository(ctx, MerchantAccount).save(account);
        }
    }

    // ---------- 店主域（requireMyShop） ----------

    async myAccount(ctx: RequestContext): Promise<MerchantAccount> {
        const shop = await this.requireMyShop(ctx);
        return this.getOrCreateAccount(ctx, shop.id as number);
    }

    async mySettlementEntries(ctx: RequestContext, options?: ListOptions): Promise<{ items: SettlementEntry[]; totalItems: number }> {
        const shop = await this.requireMyShop(ctx);
        return this.listEntries(ctx, shop.id as number, options);
    }

    async myWithdrawalRequests(ctx: RequestContext, options?: ListOptions): Promise<{ items: WithdrawalRequest[]; totalItems: number }> {
        const shop = await this.requireMyShop(ctx);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, WithdrawalRequest)
            .findAndCount({
                where: { shopId: shop.id as number, channelId: ctx.channelId as number } as any,
                order: { createdAt: 'DESC' },
                skip: options?.skip ?? 0,
                take: options?.take ?? 50,
            });
        return { items, totalItems };
    }

    async requestWithdrawal(ctx: RequestContext, amount: number): Promise<WithdrawalRequest> {
        const shop = await this.requireMyShop(ctx);
        const account = await this.getOrCreateAccount(ctx, shop.id as number);
        if (amount <= 0) {
            throw new UserInputError('Withdrawal amount must be positive');
        }
        if (amount > account.availableBalance) {
            throw new UserInputError('Insufficient balance');
        }
        const w = new WithdrawalRequest({
            channelId: ctx.channelId as number,
            shopId: shop.id as number,
            amount,
            status: 'pending',
        } as any);
        return this.connection.getRepository(ctx, WithdrawalRequest).save(w);
    }

    async mySettlementSummary(ctx: RequestContext, from?: Date, to?: Date): Promise<SettlementSummary> {
        const shop = await this.requireMyShop(ctx);
        return this.summary(ctx, shop.id as number, from, to);
    }

    // ---------- 平台管理端（UpdateSettings） ----------

    async accounts(ctx: RequestContext, options?: ListOptions): Promise<{ items: MerchantAccount[]; totalItems: number }> {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, MerchantAccount)
            .findAndCount({
                where: { channelId: ctx.channelId as number } as any,
                order: { id: 'DESC' },
                skip: options?.skip ?? 0,
                take: options?.take ?? 50,
            });
        return { items, totalItems };
    }

    async entriesByShop(ctx: RequestContext, shopId: ID, options?: ListOptions): Promise<{ items: SettlementEntry[]; totalItems: number }> {
        return this.listEntries(ctx, Number(shopId), options);
    }

    async allWithdrawalRequests(ctx: RequestContext, options?: ListOptions): Promise<{ items: WithdrawalRequest[]; totalItems: number }> {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, WithdrawalRequest)
            .findAndCount({
                where: { channelId: ctx.channelId as number } as any,
                order: { createdAt: 'DESC' },
                skip: options?.skip ?? 0,
                take: options?.take ?? 50,
            });
        return { items, totalItems };
    }

    async approveWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'approved');
        w.status = 'approved';
        return this.connection.getRepository(ctx, WithdrawalRequest).save(w);
    }

    async payWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'paid');
        const account = await this.getOrCreateAccount(ctx, w.shopId);
        if (w.amount > account.availableBalance) {
            throw new UserInputError('Insufficient balance');
        }
        account.availableBalance -= w.amount;
        account.totalWithdrawn += w.amount;
        await this.connection.getRepository(ctx, MerchantAccount).save(account);
        w.status = 'paid';
        w.paidAt = new Date();
        return this.connection.getRepository(ctx, WithdrawalRequest).save(w);
    }

    async rejectWithdrawal(ctx: RequestContext, id: ID, note?: string): Promise<WithdrawalRequest> {
        const w = await this.getWithdrawalOrThrow(ctx, id);
        this.assertTransition(w.status, 'rejected');
        w.status = 'rejected';
        w.reviewNote = note ?? null;
        return this.connection.getRepository(ctx, WithdrawalRequest).save(w);
    }

    async setMerchantCommissionRate(ctx: RequestContext, shopId: ID, rate: number): Promise<MerchantAccount> {
        if (rate < 0 || rate > 100) {
            throw new UserInputError('Commission rate must be between 0 and 100');
        }
        const account = await this.getOrCreateAccount(ctx, Number(shopId));
        account.commissionRate = rate;
        return this.connection.getRepository(ctx, MerchantAccount).save(account);
    }

    // ---------- 私有工具 ----------

    private async getOrCreateAccount(ctx: RequestContext, shopId: number): Promise<MerchantAccount> {
        const repo = this.connection.getRepository(ctx, MerchantAccount);
        const existing = await repo.findOne({
            where: { shopId, channelId: ctx.channelId as number } as any,
        });
        if (existing) {
            return existing;
        }
        const account = new MerchantAccount({
            channelId: ctx.channelId as number,
            shopId,
            commissionRate: this.options.defaultCommissionRate ?? 0,
            availableBalance: 0,
            totalGoodsAmount: 0,
            totalShippingAmount: 0,
            totalCommission: 0,
            totalWithdrawn: 0,
        } as any);
        return repo.save(account);
    }

    private async listEntries(ctx: RequestContext, shopId: number, options?: ListOptions): Promise<{ items: SettlementEntry[]; totalItems: number }> {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, SettlementEntry)
            .findAndCount({
                where: { shopId, channelId: ctx.channelId as number } as any,
                order: { settledAt: 'DESC' },
                skip: options?.skip ?? 0,
                take: options?.take ?? 50,
            });
        return { items, totalItems };
    }

    private async summary(ctx: RequestContext, shopId: number, from?: Date, to?: Date): Promise<SettlementSummary> {
        const where: any = { shopId, channelId: ctx.channelId as number };
        if (from || to) {
            where.settledAt = {};
            if (from) where.settledAt.gte = from;
            if (to) where.settledAt.lte = to;
        }
        const entries = await this.connection
            .getRepository(ctx, SettlementEntry)
            .find({ where });
        const sum = (k: 'goodsAmountWithTax' | 'shippingAmountWithTax' | 'commissionAmount' | 'netAmountWithTax') =>
            entries.reduce((acc, e) => acc + Number(e[k] ?? 0), 0);
        return {
            goodsAmountWithTax: sum('goodsAmountWithTax'),
            shippingAmountWithTax: sum('shippingAmountWithTax'),
            commissionAmount: sum('commissionAmount'),
            netAmountWithTax: sum('netAmountWithTax'),
        };
    }

    private async getWithdrawalOrThrow(ctx: RequestContext, id: ID): Promise<WithdrawalRequest> {
        return this.connection.getEntityOrThrow(ctx, WithdrawalRequest, id);
    }

    private assertTransition(from: string, to: string): void {
        const allowed: Record<string, string[]> = {
            pending: ['approved', 'rejected'],
            approved: ['paid'],
        };
        const next = allowed[from] ?? [];
        if (!next.includes(to)) {
            throw new UserInputError(`Cannot transition withdrawal from "${from}" to "${to}"`);
        }
    }

    private async requireMyShop(ctx: RequestContext): Promise<Shop> {
        // 复用 shop-plugin 阶段18 账权语义（Shop.administratorId 归属 + active 校验）。
        // 不直接注入 ShopService（跨插件模块不可注入），依核心服务/仓储复刻 resolveMyShopFromActiveUser + requireMyShop。
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) {
            throw new ForbiddenError();
        }
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { administratorId: admin.id as number } as any });
        if (!shop || shop.status !== 'active') {
            throw new ForbiddenError();
        }
        return shop;
    }

    private async resolveShopAggregation(ctx: RequestContext, order: any): Promise<ShopAggregate[]> {
        const lines = ((order as any)?.lines ?? []) as any[];
        const productIds = [
            ...new Set(lines.map((l: any) => Number(l.productVariant?.productId) || Number(l.productId)).filter((id: number) => id > 0)),
        ];
        const shopByProduct = new Map<number, number>();
        if (productIds.length > 0) {
            const products = await this.connection
                .getRepository(ctx, Product)
                .find({ where: { id: In(productIds) } as any });
            for (const p of products) {
                const sid = ((p.customFields ?? {}) as any)?.shopId;
                if (sid != null) {
                    shopByProduct.set(Number(p.id), Number(sid));
                }
            }
        }
        const subtotals = new Map<number, number>();
        for (const l of lines) {
            const pid = Number(l.productVariant?.productId) || Number(l.productId);
            const sid = shopByProduct.get(pid);
            if (sid == null) {
                continue; // 商品未归属店铺 → skip
            }
            subtotals.set(sid, (subtotals.get(sid) ?? 0) + (Number(l.linePriceWithTax) || 0));
        }
        // 运费按商品小计占比分摊给各店，末店抹平误差保证合计=订单运费
        const goodsSum = [...subtotals.values()].reduce((a, b) => a + b, 0);
        const totalShip = Number(order.shippingWithTax) || 0;
        const out: ShopAggregate[] = [];
        let allocated = 0;
        const keys = [...subtotals.keys()];
        for (let i = 0; i < keys.length; i++) {
            const shopId = keys[i];
            const goods = subtotals.get(shopId)!;
            let share = 0;
            if (goodsSum > 0 && totalShip > 0) {
                share = i === keys.length - 1
                    ? totalShip - allocated
                    : Math.round((goods / goodsSum) * totalShip);
            }
            allocated += share;
            out.push({ shopId, goodsAmountWithTax: goods, shippingAmountWithTax: share });
        }
        return out;
    }
}