import { AdministratorService, Customer, ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';
import { AffiliatePluginOptions } from './affiliate.options';
import { Affiliate } from './affiliate.entity';
import { AffiliateRelation } from './affiliate-relation.entity';
import { AffiliateCommissionEntry } from './affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
export declare class AffiliateService {
    private options;
    private connection;
    private orderService;
    private administratorService;
    constructor(options: AffiliatePluginOptions, connection: TransactionalConnection, orderService: OrderService, administratorService: AdministratorService);
    /**
     * 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。
     * 直接仓储查 Shop，勿注入 shop.service（防 DI 环）。
     */
    requireMyShop(ctx: RequestContext): Promise<Shop>;
    /** 当前活跃用户对应的 Customer（按 customer.user.id 关联）；非顾客返回 undefined。 */
    customerOf(ctx: RequestContext): Promise<Customer | undefined>;
    /** 生成唯一推广码：时间戳 base36 + 6 位易读随机字符，冲突重试（最多 10 次）。 */
    genUniqueCode(ctx: RequestContext): Promise<string>;
    /** 成为推广员：同一 userId 已有则报错；生成 code 并初始化状态与余额。 */
    becomeAffiliate(ctx: RequestContext, shopId?: ID): Promise<Affiliate>;
    /** 顾客绑定推广关系：code 查 Affiliate，拦 self-bind，幂等防重复绑定。 */
    bindRelation(ctx: RequestContext, code: string, source?: 'code' | 'click'): Promise<AffiliateRelation>;
    /**
     * 幂等生成订单佣金。仅当订单顾客已绑定某 active 推广员、且商品归属店主（shopId 非空）时，
     * 为该行生成佣金项（status pending，loadOn=options.defaultLoadOn）。
     */
    getOrCreateCommissions(ctx: RequestContext, order: Order): Promise<AffiliateCommissionEntry[]>;
    /** 费率解析：cf.affiliateRate（千分比）优先，否则 defaultRate。 */
    resolveRate(cf: Record<string, unknown>, defaultRate: number): number;
    /** 订单退款回滚：该单 pending 佣金置 reversed，并回退对应推广员余额。返回处理条数。 */
    rollbackCommissions(ctx: RequestContext, orderId: ID): Promise<number>;
    /** 重算可提现余额：pending 佣金总合 - 已支付(pay)提现总合，max(0)。 */
    reconcileWithdrawable(ctx: RequestContext, affiliateId: ID): Promise<number>;
    /** 当前用户的推广员档案。 */
    myAffiliate(ctx: RequestContext): Promise<Affiliate | undefined>;
    /** 当前用户的佣金明细，createdAt DESC。 */
    myCommissionEntries(ctx: RequestContext): Promise<AffiliateCommissionEntry[]>;
    /** 申请提现：校验余额充足后创建 pending 提现单。 */
    requestWithdrawal(ctx: RequestContext, amount: number): Promise<AffiliateWithdrawal>;
    /** 店主支付提现（幂等：非 pending 直接返回）。 */
    payWithdrawalSafe(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal>;
    /** 店主拒绝提现（幂等）：pending → 重算回放余额 → rejected。 */
    rejectWithdrawalSafe(ctx: RequestContext, id: ID): Promise<AffiliateWithdrawal>;
    /** 本 channel 全量推广员。 */
    affiliates(ctx: RequestContext): Promise<Affiliate[]>;
    /** 本 channel 全量提现单。 */
    withdrawals(ctx: RequestContext): Promise<AffiliateWithdrawal[]>;
}
