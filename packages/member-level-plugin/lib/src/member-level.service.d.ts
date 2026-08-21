import { ChannelService, ConfigService, CustomerService, ID, ListQueryBuilder, ListQueryOptions, Order, OrderService, PaginatedList, Refund, RequestContext, TransactionalConnection } from '@vendure/core';
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
export declare class MemberLevelService {
    private connection;
    private listQueryBuilder;
    private customerService;
    private channelService;
    private configService;
    private orderService;
    private readonly supportsPessimisticLock;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService, channelService: ChannelService, configService: ConfigService, orderService: OrderService);
    /**
     * 折算率：多少积分抵 1 元。读 Channel.pointsPerYuan，未配置用默认 100（100 积分抵 1 元）。
     */
    private getPointsPerYuan;
    /**
     * 积分有效期（天），0=不过期。读 Channel.pointsExpireDays。
     */
    private getPointsExpireDays;
    /**
     * 包装 customer 查询：驱动支持时加 pessimistic_write 锁，sqljs/better-sqlite3 跳过锁
     * 并发安全在生产驱动（mysql/postgres）由悲观锁保证；sqljs 测试环境降级为无锁。
     */
    private loadCustomerForUpdate;
    getMemberInfo(ctx: RequestContext, customerId: ID): Promise<MemberInfo>;
    getMyMemberInfo(ctx: RequestContext): Promise<MemberInfo>;
    addGrowthValue(ctx: RequestContext, customerId: ID, amount: number, source?: string): Promise<number>;
    addPoints(ctx: RequestContext, customerId: ID, amount: number, orderId?: ID | null, remark?: string | null, expiresAt?: Date | null): Promise<number>;
    spendPoints(ctx: RequestContext, customerId: ID, amount: number, orderId?: ID | null, remark?: string | null): Promise<number>;
    adjustPoints(ctx: RequestContext, customerId: ID, amount: number, remark?: string | null): Promise<number>;
    calculateLevel(ctx: RequestContext, growthValue: number): number;
    getMyPointsHistory(ctx: RequestContext, options?: ListQueryOptions<MemberPointsHistory>): Promise<PaginatedList<MemberPointsHistory>>;
    getPointsHistory(ctx: RequestContext, customerId: ID, options?: ListQueryOptions<MemberPointsHistory>): Promise<PaginatedList<MemberPointsHistory>>;
    hasPointsRecord(ctx: RequestContext, customerId: ID, orderId: ID, type: PointsHistoryType): Promise<boolean>;
    /**
     * 幂等判重：按订单 + 明细类型 + remark 前缀检查是否已有同源积分明细
     * （如取消回退 `order_cancelled:` / 退款回退 `refund_settled:` / 过期 `earn_expired:`）。
     */
    private hasPointsRemark;
    /**
     * 积分抵现（绑定即扣）：
     * 1. 校验登录、订单归属、points 为正整数
     * 2. 折算：discountAmount = floor(points / pointsPerYuan) * 100（分）
     * 3. 校验：折算金额 > 0 且 < 订单 subTotal（不能全免单）
     * 4. 原子扣减积分余额（pessimistic lock 或 sqljs 降级）+ 写 SPEND 明细
     * 5. 写订单 customFields（pointsToRedeem / pointsRedeemAmount）→ 重算价格触发积分抵现 Promotion
     * 6. 幂等：同一订单已绑定相同积分直接返回当前订单
     */
    redeemPoints(ctx: RequestContext, points: number): Promise<Order>;
    /**
     * 取消回退：订单取消时按已抵扣积分全额回退（EARN 明细）+ 清空订单字段。
     * 幂等：该订单已有 `order_cancelled:` EARN 明细则跳过。
     */
    releasePointsByOrder(ctx: RequestContext, order: Order): Promise<void>;
    /**
     * 退款按比例回退：Refund Settled 时按 floor(pointsToRedeem × refund.total / order.totalWithTax)
     * 回退已抵扣积分（EARN 明细）。幂等：该订单已有 `refund_settled:` EARN 明细则跳过。
     *
     * 口径说明：refund.total 是含税金额（proratedUnitPriceWithTax + shipping/withTax），
     * 必须用 order.totalWithTax 作分母保持同口径，否则含税价下比例 ≠ 1，退回积分会多退。
     */
    refundPointsByOrder(ctx: RequestContext, order: Order, refund: Refund): Promise<void>;
    /**
     * 过期清理：扫描本渠道 type=EARN 且 expiresAt 已过且 amount>0 的明细，
     * 逐条幂等扣减余额并写 EXPIRE 明细（remark=`earn_expired:<earnId>`）。返回处理条数。
     */
    expireEarnedPoints(ctx: RequestContext): Promise<number>;
    findAllMembers(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        filter?: {
            emailAddress?: string;
            level?: number;
        };
    }): Promise<PaginatedList<MemberListItem>>;
    getLevelConfig(ctx: RequestContext): ChannelLevelConfig;
    updateLevelConfig(ctx: RequestContext, input: Partial<ChannelLevelConfig>): Promise<ChannelLevelConfig>;
    private applyPointsChange;
    private buildMemberInfo;
    private getLevelThresholds;
    private getLevelName;
    private getNextLevel;
    /**
     * 播种：仅当本渠道无任何 MemberTier 记录时，从 channel level* 字段 + 默认权益生成。
     * 幂等：already seeded 直接返回；并发由唯一索引 (tierLevel, channelId) 兜底。
     */
    private seedDefaultTiers;
    /** 解析顾客当前档位：读成长值 → 查表（未播种先播种）→ threshold<=growth 的最大 tierLevel。 */
    resolveTierForCustomer(ctx: RequestContext, customerId: ID): Promise<MemberTier>;
    /** 按成长值解析档位（表驱动，未播种先播种兜底）。 */
    resolveTierForGrowth(ctx: RequestContext, growthValue: number): Promise<MemberTier>;
    /** 下一档位（threshold/name），已最高档返回 null/null。 */
    private getNextTier;
    /**
     * 整体保存各档（幂等 upsert）：按 (tierLevel, channelId) 匹配更新或新增；
     * 入参之外的旧档保留。返回保存后按 tierLevel 升序的全量列表。
     */
    saveMemberTiers(ctx: RequestContext, input: Array<{
        tierLevel: number;
        threshold: number;
        name: string;
        pointsMultiplier?: number;
        redeemDiscountRate?: number;
        redeemCapRatio?: number;
        specialDiscountRate?: number;
    }>): Promise<MemberTier[]>;
    /** 列表查询（未播种先播种）。 */
    listMemberTiers(ctx: RequestContext): Promise<MemberTier[]>;
}
