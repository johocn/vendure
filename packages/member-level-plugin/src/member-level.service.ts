import { Injectable } from '@nestjs/common';
import { Like } from 'typeorm';
import {
    ChannelService,
    ConfigService,
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    Order,
    OrderService,
    PaginatedList,
    Refund,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

// 不支持 pessimistic_write 锁的驱动（sqljs 内存库用于测试，better-sqlite3 同步驱动无锁）
const NO_LOCK_DRIVERS = ['sqljs', 'better-sqlite3'];

import { loggerCtx } from './constants';
import { MemberPointsHistory, PointsHistoryType } from './member-points-history.entity';
import { MemberTier } from './member-tier.entity';

export interface MemberInfo {
    customerId: ID;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    nextLevelThreshold: number | null;
    nextLevelName: string | null;
    pointsMultiplier: number;
    redeemDiscountRate: number;
    redeemCapRatio: number;
    specialDiscountRate: number;
}

export interface ChannelLevelConfig {
    level1Threshold: number;
    level1Name: string;
    level2Threshold: number;
    level2Name: string;
    level3Threshold: number;
    level3Name: string;
    level4Threshold: number;
    level4Name: string;
    level5Threshold: number;
    level5Name: string;
    pointsEarnRatio: number;
    pointsEarnOnShipping: boolean;
}

export interface MemberListItem {
    customerId: ID;
    emailAddress: string | null;
    firstName: string | null;
    lastName: string | null;
    level: number;
    levelName: string;
    growthValue: number;
    points: number;
    createdAt: Date;
}

interface LevelConfig {
    thresholds: number[];
    names: string[];
}

const DEFAULT_THRESHOLDS = [0, 1000, 5000, 20000, 100000];
const DEFAULT_NAMES = ['普通会员', '银卡会员', '金卡会员', '白金会员', '钻石会员'];

@Injectable()
export class MemberLevelService {
    private readonly supportsPessimisticLock: boolean;
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
        private channelService: ChannelService,
        private configService: ConfigService,
        private orderService: OrderService,
    ) {
        const driverType = (this.configService.dbConnectionOptions as any).type as string;
        this.supportsPessimisticLock = !NO_LOCK_DRIVERS.includes(driverType);
    }

    /**
     * 折算率：多少积分抵 1 元。读 Channel.pointsPerYuan，未配置用默认 100（100 积分抵 1 元）。
     */
    private getPointsPerYuan(ctx: RequestContext): number {
        return (ctx.channel as any)?.customFields?.pointsPerYuan ?? 100;
    }

    /**
     * 积分有效期（天），0=不过期。读 Channel.pointsExpireDays。
     */
    private getPointsExpireDays(ctx: RequestContext): number {
        return (ctx.channel as any)?.customFields?.pointsExpireDays ?? 0;
    }

    /**
     * 包装 customer 查询：驱动支持时加 pessimistic_write 锁，sqljs/better-sqlite3 跳过锁
     * 并发安全在生产驱动（mysql/postgres）由悲观锁保证；sqljs 测试环境降级为无锁。
     */
    private async loadCustomerForUpdate(
        repo: ReturnType<TransactionalConnection['getRepository']>,
        customerId: ID,
    ): Promise<Customer | null> {
        const qb = repo.createQueryBuilder('customer').where('customer.id = :id', {
            id: customerId,
        });
        if (this.supportsPessimisticLock) {
            qb.setLock('pessimistic_write');
        }
        return (qb.getOne() as Promise<Customer | null>);
    }

    // ===== Public API =====

    async getMemberInfo(ctx: RequestContext, customerId: ID): Promise<MemberInfo> {
        const customer = await this.customerService.findOne(ctx, customerId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', customerId);
        }
        return this.buildMemberInfo(ctx, customer);
    }

    async getMyMemberInfo(ctx: RequestContext): Promise<MemberInfo> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.buildMemberInfo(ctx, customer);
    }

    async addGrowthValue(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        source?: string,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new UserInputError('amount must be a non-zero integer');
        }
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, Customer);
            const customer = await this.loadCustomerForUpdate(repo, customerId);
            if (!customer) {
                throw new EntityNotFoundError('Customer', customerId);
            }
            const cf = (customer as any).customFields ?? {};
            const currentGrowth = cf.growthValue ?? 0;
            const newGrowth = Math.max(0, currentGrowth + amt);
            cf.growthValue = newGrowth;
            const tier = await this.resolveTierForGrowth(txCtx, newGrowth);
            const newLevel = tier.tierLevel;
            cf.memberLevel = newLevel;
            await repo.save(customer);
            Logger.info(
                `Customer ${customerId} growthValue ${currentGrowth} -> ${newGrowth} (${source ?? ''})`,
                loggerCtx,
            );
            return newGrowth;
        });
    }

    async addPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        orderId?: ID | null,
        remark?: string | null,
        expiresAt?: Date | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(
            ctx,
            customerId,
            amt,
            PointsHistoryType.EARN,
            orderId,
            remark,
            expiresAt,
        );
    }

    async spendPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        orderId?: ID | null,
        remark?: string | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, -amt, PointsHistoryType.SPEND, orderId, remark);
    }

    async adjustPoints(
        ctx: RequestContext,
        customerId: ID,
        amount: number,
        remark?: string | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new UserInputError('amount must be a non-zero integer');
        }
        return this.applyPointsChange(
            ctx,
            customerId,
            amt,
            PointsHistoryType.ADJUST,
            undefined,
            remark,
        );
    }

    calculateLevel(ctx: RequestContext, growthValue: number): number {
        const { thresholds } = this.getLevelThresholds(ctx);
        let level = 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (growthValue >= thresholds[i]) {
                level = i + 1;
            }
        }
        return level;
    }

    async getMyPointsHistory(
        ctx: RequestContext,
        options?: ListQueryOptions<MemberPointsHistory>,
    ): Promise<PaginatedList<MemberPointsHistory>> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.getPointsHistory(ctx, customer.id, options);
    }

    async getPointsHistory(
        ctx: RequestContext,
        customerId: ID,
        options?: ListQueryOptions<MemberPointsHistory>,
    ): Promise<PaginatedList<MemberPointsHistory>> {
        return this.listQueryBuilder
            .build(MemberPointsHistory, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
                where: { customerId: customerId as any },
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async hasPointsRecord(
        ctx: RequestContext,
        customerId: ID,
        orderId: ID,
        type: PointsHistoryType,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, MemberPointsHistory);
        const count = await repo.count({
            where: { customerId: customerId as any, orderId: Number(orderId), type },
        });
        return count > 0;
    }

    /**
     * 幂等判重：按订单 + 明细类型 + remark 前缀检查是否已有同源积分明细
     * （如取消回退 `order_cancelled:` / 退款回退 `refund_settled:` / 过期 `earn_expired:`）。
     */
    private async hasPointsRemark(
        ctx: RequestContext,
        customerId: ID,
        orderId: ID,
        type: PointsHistoryType,
        remarkPrefix: string,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, MemberPointsHistory);
        const count = await repo.count({
            where: {
                customerId: customerId as any,
                orderId: Number(orderId),
                type,
                remark: Like(`${remarkPrefix}%`),
            },
        });
        return count > 0;
    }

    /**
     * 积分抵现（绑定即扣）：
     * 1. 校验登录、订单归属、points 为正整数
     * 2. 折算：discountAmount = floor(points / pointsPerYuan) * 100（分）
     * 3. 校验：折算金额 > 0 且 < 订单 subTotal（不能全免单）
     * 4. 原子扣减积分余额（pessimistic lock 或 sqljs 降级）+ 写 SPEND 明细
     * 5. 写订单 customFields（pointsToRedeem / pointsRedeemAmount）→ 重算价格触发积分抵现 Promotion
     * 6. 幂等：同一订单已绑定相同积分直接返回当前订单
     */
    async redeemPoints(ctx: RequestContext, points: number): Promise<Order> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new UserInputError('Not authenticated');
        }
        const amt = Math.floor(points);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('points must be a positive integer');
        }
        const customer = await this.customerService.findOneByUserId(ctx, userId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', userId);
        }
        const order = await this.orderService.getActiveOrderForUser(ctx, userId);
        if (!order) {
            throw new UserInputError('No active order found');
        }
        // 归属校验：用 customer.user.id（登录 User 主键），勿用 customer.id
        if ((order as any)?.customer?.user?.id !== userId) {
            throw new UserInputError('You can only redeem points on your own order');
        }
        // 幂等：同一订单已绑定相同积分直接返回
        if ((order as any)?.customFields?.pointsToRedeem === amt) {
            return this.orderService.findOne(ctx, order.id, [
                'lines',
                'lines.productVariant',
            ]) as Promise<Order>;
        }

        const pointsPerYuan = this.getPointsPerYuan(ctx);
        const tier = await this.resolveTierForGrowth(ctx, (customer as any)?.customFields?.growthValue ?? 0);
        const rate = tier.redeemDiscountRate ?? 1000;
        const effectivePerYuan = Math.ceil((pointsPerYuan * 1000) / rate);
        const baseAmount = Math.floor(amt / effectivePerYuan) * 100;
        const subTotal = order.subTotal ?? 0;
        // 封顶：可抵不超过订单金额上限比例（redeemCapRatio 千分比，默认 500 = 最多抵 50%）
        const capRatio = tier.redeemCapRatio ?? 500;
        const cap = Math.floor((subTotal * capRatio) / 1000);
        const discountAmount = Math.min(baseAmount, cap);
        if (discountAmount <= 0) {
            throw new UserInputError('Redeemed amount is zero');
        }
        if (discountAmount >= subTotal) {
            throw new UserInputError('Redeemed amount must be less than order subtotal');
        }

        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, Customer);
            const locked = await this.loadCustomerForUpdate(repo, customer.id);
            if (!locked) {
                throw new EntityNotFoundError('Customer', customer.id);
            }
            const ccf = (locked as any).customFields ?? {};
            const balance = ccf.points ?? 0;
            if (balance < amt) {
                throw new UserInputError('Insufficient points');
            }
            ccf.points = balance - amt;
            await repo.save(locked);

            const history = new MemberPointsHistory({
                customerId: customer.id as any,
                type: PointsHistoryType.SPEND,
                amount: -amt,
                balanceBefore: balance,
                balanceAfter: balance - amt,
                orderId: Number(order.id),
                remark: 'points_redeem',
            });
            history.channelId = txCtx.channelId as number;
            history.channels = [txCtx.channel];
            await this.connection.getRepository(txCtx, MemberPointsHistory).save(history);

            // 写订单字段 → 触发积分抵现 Promotion 折让 → 重算价格
            const updatedOrder = await this.orderService.updateCustomFields(txCtx, order.id, {
                pointsToRedeem: amt,
                pointsRedeemAmount: discountAmount,
            });
            await this.orderService.applyPriceAdjustments(txCtx, updatedOrder);
            Logger.info(
                `Customer ${customer.id} redeemed ${amt} points (${discountAmount}分) on order ${order.id}`,
                loggerCtx,
            );
            return this.orderService.findOne(txCtx, order.id, [
                'lines',
                'lines.productVariant',
            ]) as Promise<Order>;
        });
    }

    /**
     * 取消回退：订单取消时按已抵扣积分全额回退（EARN 明细）+ 清空订单字段。
     * 幂等：该订单已有 `order_cancelled:` EARN 明细则跳过。
     */
    async releasePointsByOrder(ctx: RequestContext, order: Order): Promise<void> {
        const pointsToRedeem = (order as any)?.customFields?.pointsToRedeem ?? 0;
        if (pointsToRedeem <= 0) return;
        const customerId = (order as any)?.customer?.id;
        if (customerId == null) return;
        if (
            await this.hasPointsRemark(
                ctx,
                customerId,
                order.id,
                PointsHistoryType.EARN,
                'order_cancelled:',
            )
        ) {
            return;
        }
        await this.connection.withTransaction(ctx, async txCtx => {
            await this.addPoints(
                txCtx,
                customerId,
                pointsToRedeem,
                order.id,
                `order_cancelled:${order.id}`,
            );
            await this.orderService.updateCustomFields(txCtx, order.id, {
                pointsToRedeem: 0,
                pointsRedeemAmount: 0,
            });
        });
        Logger.info(
            `Order ${order.id} cancelled: released ${pointsToRedeem} points to customer ${customerId}`,
            loggerCtx,
        );
    }

    /**
     * 退款按比例回退：Refund Settled 时按 floor(pointsToRedeem × refund.total / order.totalWithTax)
     * 回退已抵扣积分（EARN 明细）。幂等：该订单已有 `refund_settled:` EARN 明细则跳过。
     *
     * 口径说明：refund.total 是含税金额（proratedUnitPriceWithTax + shipping/withTax），
     * 必须用 order.totalWithTax 作分母保持同口径，否则含税价下比例 ≠ 1，退回积分会多退。
     */
    async refundPointsByOrder(ctx: RequestContext, order: Order, refund: Refund): Promise<void> {
        // 事件携带的 order 不一定加载了 customer / customFields，这里用 OrderService 按 id 重载
        // 保证能读到归属 customer 与 pointsToRedeem（退款事件 order.customer 为空是常见坑）。
        const reloaded =
            (await this.orderService.findOne(ctx, order.id, ['customer'])) ?? order;
        const pointsToRedeem = (reloaded as any)?.customFields?.pointsToRedeem ?? 0;
        if (pointsToRedeem <= 0) return;
        const customerId = (reloaded as any)?.customer?.id;
        if (customerId == null) return;
        const orderTotal = reloaded.totalWithTax ?? 0;
        const refundAmount = refund.total ?? 0;
        if (orderTotal <= 0 || refundAmount <= 0) return;
        const pointsToReturn = Math.floor((pointsToRedeem * refundAmount) / orderTotal);
        if (pointsToReturn <= 0) return;
        if (
            await this.hasPointsRemark(
                ctx,
                customerId,
                order.id,
                PointsHistoryType.EARN,
                'refund_settled:',
            )
        ) {
            return;
        }
        await this.connection.withTransaction(ctx, async txCtx => {
            await this.addPoints(
                txCtx,
                customerId,
                pointsToReturn,
                order.id,
                `refund_settled:${refund.id}`,
            );
        });
        Logger.info(
            `Refund ${refund.id} for order ${order.id}: returned ${pointsToReturn} points to customer ${customerId}`,
            loggerCtx,
        );
    }

    /**
     * 过期清理：扫描本渠道 type=EARN 且 expiresAt 已过且 amount>0 的明细，
     * 逐条幂等扣减余额并写 EXPIRE 明细（remark=`earn_expired:<earnId>`）。返回处理条数。
     */
    async expireEarnedPoints(ctx: RequestContext): Promise<number> {
        // 从 DB 重新拉取 channel 配置（不能依赖 ctx.channel 快照：admin/定时上下文可能持有
        // 早于 pointsExpireDays 配置更新的快照，否则 expireDays 恒为默认 0 导致永远扫不到过期单）。
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const expireDays = (channel as any)?.customFields?.pointsExpireDays ?? 0;
        if (expireDays <= 0) return 0;
        const now = new Date();
        const repo = this.connection.getRepository(ctx, MemberPointsHistory);
        const expired = await repo
            .createQueryBuilder('mph')
            .where('mph.type = :type', { type: PointsHistoryType.EARN })
            .andWhere('mph.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('mph.expiresAt IS NOT NULL')
            .andWhere('mph.expiresAt < :now', { now })
            .andWhere('mph.amount > 0')
            .getMany();

        let count = 0;
        for (const record of expired) {
            const already = await repo.count({
                where: {
                    customerId: record.customerId,
                    type: PointsHistoryType.EXPIRE,
                    remark: `earn_expired:${record.id}`,
                },
            });
            if (already > 0) continue;

            await this.connection.withTransaction(ctx, async txCtx => {
                const customerRepo = this.connection.getRepository(txCtx, Customer);
                const customer = await this.loadCustomerForUpdate(customerRepo, record.customerId as any);
                if (!customer) return;
                const ccf = (customer as any).customFields ?? {};
                const balance = ccf.points ?? 0;
                const deduct = Math.min(record.amount, balance);
                if (deduct <= 0) return;
                ccf.points = balance - deduct;
                await customerRepo.save(customer);

                const history = new MemberPointsHistory({
                    customerId: record.customerId,
                    type: PointsHistoryType.EXPIRE,
                    amount: -deduct,
                    balanceBefore: balance,
                    balanceAfter: balance - deduct,
                    orderId: null,
                    remark: `earn_expired:${record.id}`,
                });
                history.channelId = txCtx.channelId as number;
                history.channels = [txCtx.channel];
                await this.connection.getRepository(txCtx, MemberPointsHistory).save(history);
            });
            count++;
        }
        if (count > 0) {
            Logger.info(`Points expiration: expired ${count} records`, loggerCtx);
        }
        return count;
    }

    async findAllMembers(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; filter?: { emailAddress?: string; level?: number } },
    ): Promise<PaginatedList<MemberListItem>> {
        const listOptions: ListQueryOptions<Customer> = {};
        if (options) {
            if (options.skip != null) listOptions.skip = options.skip;
            if (options.take != null) listOptions.take = options.take;
            if (options.filter) {
                const filter: any = {};
                if (options.filter.emailAddress) {
                    filter.emailAddress = { contains: options.filter.emailAddress };
                }
                if (options.filter.level != null) {
                    filter.customFields = { memberLevel: { eq: options.filter.level } };
                }
                if (Object.keys(filter).length > 0) {
                    listOptions.filter = filter;
                }
            }
        }
        const [customers, totalItems] = await this.listQueryBuilder
            .build(Customer, listOptions, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount();
        const items = customers.map((c) => {
            const cf = (c as any).customFields ?? {};
            const level = cf.memberLevel ?? 1;
            return {
                customerId: c.id,
                emailAddress: c.emailAddress,
                firstName: c.firstName,
                lastName: c.lastName,
                level,
                levelName: this.getLevelName(ctx, level),
                growthValue: cf.growthValue ?? 0,
                points: cf.points ?? 0,
                createdAt: c.createdAt,
            } as MemberListItem;
        });
        return { items, totalItems };
    }

    getLevelConfig(ctx: RequestContext): ChannelLevelConfig {
        const cf = (ctx.channel as any).customFields ?? {};
        return {
            level1Threshold: cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
            level1Name: cf.level1Name ?? DEFAULT_NAMES[0],
            level2Threshold: cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
            level2Name: cf.level2Name ?? DEFAULT_NAMES[1],
            level3Threshold: cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
            level3Name: cf.level3Name ?? DEFAULT_NAMES[2],
            level4Threshold: cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
            level4Name: cf.level4Name ?? DEFAULT_NAMES[3],
            level5Threshold: cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            level5Name: cf.level5Name ?? DEFAULT_NAMES[4],
            pointsEarnRatio: cf.pointsEarnRatio ?? 1,
            pointsEarnOnShipping: cf.pointsEarnOnShipping ?? false,
        };
    }

    async updateLevelConfig(ctx: RequestContext, input: Partial<ChannelLevelConfig>): Promise<ChannelLevelConfig> {
        await this.channelService.update(ctx, {
            id: ctx.channelId,
            customFields: {
                level1Threshold: input.level1Threshold,
                level1Name: input.level1Name,
                level2Threshold: input.level2Threshold,
                level2Name: input.level2Name,
                level3Threshold: input.level3Threshold,
                level3Name: input.level3Name,
                level4Threshold: input.level4Threshold,
                level4Name: input.level4Name,
                level5Threshold: input.level5Threshold,
                level5Name: input.level5Name,
                pointsEarnRatio: input.pointsEarnRatio,
                pointsEarnOnShipping: input.pointsEarnOnShipping,
            },
        } as any);
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const cf = (channel as any)?.customFields ?? (ctx.channel as any).customFields ?? {};
        return {
            level1Threshold: cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
            level1Name: cf.level1Name ?? DEFAULT_NAMES[0],
            level2Threshold: cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
            level2Name: cf.level2Name ?? DEFAULT_NAMES[1],
            level3Threshold: cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
            level3Name: cf.level3Name ?? DEFAULT_NAMES[2],
            level4Threshold: cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
            level4Name: cf.level4Name ?? DEFAULT_NAMES[3],
            level5Threshold: cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            level5Name: cf.level5Name ?? DEFAULT_NAMES[4],
            pointsEarnRatio: cf.pointsEarnRatio ?? 1,
            pointsEarnOnShipping: cf.pointsEarnOnShipping ?? false,
        };
    }

    // ===== Internal helpers =====

    private async applyPointsChange(
        ctx: RequestContext,
        customerId: ID,
        delta: number,
        type: PointsHistoryType,
        orderId?: ID | null,
        remark?: string | null,
        expiresAt?: Date | null,
    ): Promise<number> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, Customer);
            const customer = await this.loadCustomerForUpdate(repo, customerId);
            if (!customer) {
                throw new EntityNotFoundError('Customer', customerId);
            }
            const cf = (customer as any).customFields ?? {};
            const balanceBefore = cf.points ?? 0;
            const balanceAfter = balanceBefore + delta;
            if (balanceAfter < 0) {
                throw new UserInputError('Insufficient points');
            }
            cf.points = balanceAfter;
            await repo.save(customer);

            const history = new MemberPointsHistory({
                customerId: customerId as any,
                type,
                amount: delta,
                balanceBefore,
                balanceAfter,
                orderId: orderId != null ? Number(orderId) : null,
                remark: remark ?? null,
                expiresAt: expiresAt ?? null,
            });
            history.channelId = txCtx.channelId as number;
            history.channels = [txCtx.channel];
            await this.connection.getRepository(txCtx, MemberPointsHistory).save(history);

            return balanceAfter;
        });
    }

    private async buildMemberInfo(ctx: RequestContext, customer: Customer): Promise<MemberInfo> {
        const cf = (customer as any).customFields ?? {};
        const growthValue = cf.growthValue ?? 0;
        const points = cf.points ?? 0;
        const tier = await this.resolveTierForGrowth(ctx, growthValue);
        const next = await this.getNextTier(ctx, tier.tierLevel);
        return {
            customerId: customer.id,
            level: tier.tierLevel,
            levelName: tier.name,
            growthValue,
            points,
            nextLevelThreshold: next.threshold,
            nextLevelName: next.name,
            pointsMultiplier: tier.pointsMultiplier,
            redeemDiscountRate: tier.redeemDiscountRate,
            redeemCapRatio: tier.redeemCapRatio,
            specialDiscountRate: tier.specialDiscountRate,
        };
    }

    private getLevelThresholds(ctx: RequestContext): LevelConfig {
        const cf = (ctx.channel as any).customFields ?? {};
        return {
            thresholds: [
                cf.level1Threshold ?? DEFAULT_THRESHOLDS[0],
                cf.level2Threshold ?? DEFAULT_THRESHOLDS[1],
                cf.level3Threshold ?? DEFAULT_THRESHOLDS[2],
                cf.level4Threshold ?? DEFAULT_THRESHOLDS[3],
                cf.level5Threshold ?? DEFAULT_THRESHOLDS[4],
            ],
            names: [
                cf.level1Name ?? DEFAULT_NAMES[0],
                cf.level2Name ?? DEFAULT_NAMES[1],
                cf.level3Name ?? DEFAULT_NAMES[2],
                cf.level4Name ?? DEFAULT_NAMES[3],
                cf.level5Name ?? DEFAULT_NAMES[4],
            ],
        };
    }

    private getLevelName(ctx: RequestContext, level: number): string {
        const { names } = this.getLevelThresholds(ctx);
        return names[Math.min(Math.max(level, 1), 5) - 1];
    }

    private getNextLevel(
        ctx: RequestContext,
        level: number,
    ): { threshold: number | null; name: string | null } {
        if (level >= 5) {
            return { threshold: null, name: null };
        }
        const { thresholds, names } = this.getLevelThresholds(ctx);
        return { threshold: thresholds[level], name: names[level] };
    }

    // ===== MemberTier 表驱动（阶段30） =====

    /**
     * 播种：仅当本渠道无任何 MemberTier 记录时，从 channel level* 字段 + 默认权益生成。
     * 幂等：already seeded 直接返回；并发由唯一索引 (tierLevel, channelId) 兜底。
     */
    private async seedDefaultTiers(ctx: RequestContext): Promise<MemberTier[]> {
        const repo = this.connection.getRepository(ctx, MemberTier);
        const existing = await repo.find({ where: { channelId: ctx.channelId as number } as any });
        if (existing.length > 0) return existing;
        const cf = (ctx.channel as any).customFields ?? {};
        const defs = [1, 2, 3, 4, 5].map(level => ({
            tierLevel: level,
            threshold: cf[`level${level}Threshold`] ?? DEFAULT_THRESHOLDS[level - 1],
            name: cf[`level${level}Name`] ?? DEFAULT_NAMES[level - 1],
            pointsMultiplier: 1000,
            redeemDiscountRate: 1000,
            redeemCapRatio: 500,
            specialDiscountRate: 0,
        }));
        const saved: MemberTier[] = [];
        for (const d of defs) {
            const t = new MemberTier({ ...d, channelId: ctx.channelId as number });
            t.channels = [ctx.channel];
            saved.push(await repo.save(t));
        }
        return saved;
    }

    /** 解析顾客当前档位：读成长值 → 查表（未播种先播种）→ threshold<=growth 的最大 tierLevel。 */
    async resolveTierForCustomer(ctx: RequestContext, customerId: ID): Promise<MemberTier> {
        const customer = await this.customerService.findOne(ctx, customerId);
        const growth = (customer as any)?.customFields?.growthValue ?? 0;
        return this.resolveTierForGrowth(ctx, growth);
    }

    /** 按成长值解析档位（表驱动，未播种先播种兜底）。 */
    async resolveTierForGrowth(ctx: RequestContext, growthValue: number): Promise<MemberTier> {
        const repo = this.connection.getRepository(ctx, MemberTier);
        const all = await repo.find({
            where: { channelId: ctx.channelId as number } as any,
            order: { tierLevel: 'ASC' },
        });
        if (all.length === 0) {
            const seeded = await this.seedDefaultTiers(ctx);
            return seeded[0];
        }
        let hit = all[0];
        for (const t of all) {
            if (growthValue >= t.threshold) {
                hit = t;
            }
        }
        return hit;
    }

    /** 下一档位（threshold/name），已最高档返回 null/null。 */
    private async getNextTier(
        ctx: RequestContext,
        level: number,
    ): Promise<{ threshold: number | null; name: string | null }> {
        const repo = this.connection.getRepository(ctx, MemberTier);
        const all = await repo.find({
            where: { channelId: ctx.channelId as number } as any,
            order: { tierLevel: 'ASC' },
        });
        const next = all.find(t => t.tierLevel > level);
        if (!next) return { threshold: null, name: null };
        return { threshold: next.threshold, name: next.name };
    }

    /**
     * 整体保存各档（幂等 upsert）：按 (tierLevel, channelId) 匹配更新或新增；
     * 入参之外的旧档保留。返回保存后按 tierLevel 升序的全量列表。
     */
    async saveMemberTiers(
        ctx: RequestContext,
        input: Array<{
            tierLevel: number;
            threshold: number;
            name: string;
            pointsMultiplier?: number;
            redeemDiscountRate?: number;
            redeemCapRatio?: number;
            specialDiscountRate?: number;
        }>,
    ): Promise<MemberTier[]> {
        const sorted = [...input].sort((a, b) => a.tierLevel - b.tierLevel);
        const repo = this.connection.getRepository(ctx, MemberTier);
        const existing = await repo.find({ where: { channelId: ctx.channelId as number } as any });
        for (const item of sorted) {
            const found = existing.find(e => e.tierLevel === item.tierLevel);
            const data = {
                threshold: item.threshold,
                name: item.name,
                pointsMultiplier: item.pointsMultiplier ?? found?.pointsMultiplier ?? 1000,
                redeemDiscountRate: item.redeemDiscountRate ?? found?.redeemDiscountRate ?? 1000,
                redeemCapRatio: item.redeemCapRatio ?? found?.redeemCapRatio ?? 500,
                specialDiscountRate: item.specialDiscountRate ?? found?.specialDiscountRate ?? 0,
            };
            if (found) {
                await repo.update(found.id, data as any);
            } else {
                const t = new MemberTier({ ...data, tierLevel: item.tierLevel, channelId: ctx.channelId as number });
                t.channels = [ctx.channel];
                await repo.save(t);
            }
        }
        return repo.find({
            where: { channelId: ctx.channelId as number } as any,
            order: { tierLevel: 'ASC' },
        });
    }

    /** 列表查询（未播种先播种）。 */
    async listMemberTiers(ctx: RequestContext): Promise<MemberTier[]> {
        await this.seedDefaultTiers(ctx);
        const repo = this.connection.getRepository(ctx, MemberTier);
        return repo.find({
            where: { channelId: ctx.channelId as number } as any,
            order: { tierLevel: 'ASC' },
        });
    }
}
