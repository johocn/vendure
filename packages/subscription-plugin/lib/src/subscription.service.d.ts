import { AdministratorService, ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { SubscriptionOccurrence } from './subscription-occurrence.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionListOptions, SubscriptionItem, SubscriptionPluginOptions } from './types';
/**
 * 周期购/订阅复购核心：买断开通（购审 + 展开排期）、每期生成正式订单并抵扣预存款、
 * 每日调度扫到期期次、续订确认、取消、平台/店主/买家查询，以及 requireMyShop 归属隔离。
 */
export declare class SubscriptionService {
    private options;
    private connection;
    private orderService;
    private administratorService;
    constructor(options: SubscriptionPluginOptions, connection: TransactionalConnection, orderService: OrderService, administratorService: AdministratorService);
    /** 从 startDate 出发按频次展开 N 个期次日（不含 startDate 当日之前）。 */
    expandSchedule(frequency: any, periods: number, startDate: Date): Date[];
    private nextDate;
    /**
     * 买断开通：创建 Subscription（active）+ 展开排期生成 1..N 个 pending 期次。
     * 平台统一征收（collectBuyoutCentrally 为 true 时预存款初始化为买断总价）。
     */
    createSubscription(ctx: RequestContext, customerId: number, planId: ID, startDate: string): Promise<Subscription>;
    /**
     * 每日调度 / 手动驱动：扫所有到期 pending 期次。
     * 卖家未指定内容 → skipped；已指定 → createFormalOrder + deductPrepaid。
     */
    processDueOccurrences(ctx: RequestContext, asOf?: Date): Promise<{
        created: number;
        skipped: number;
    }>;
    /** 用 OrderService 建正式订单并加入期次清单，补全收货地址/运费/支付后推进到 PaymentSettled。 */
    private createFormalOrder;
    /** 从插件配置或当前 channel 已启用支付方式中解析支付方式 code，用于 Buyout 统一采集。 */
    private resolvePaymentMethodCode;
    /** 期次订单默认收货地址（买到到店无需真实门牌，仅占位）。 */
    private defaultShippingAddress;
    /** 过渡订单状态；已在目标态则视为成功，否则抛错以触发创建事务回滚。 */
    private transitionToStateChecked;
    /** 每期按 periodPrice 抵扣预存款；余额不足则回滚期次 pending 并抛错。 */
    private deductPrepaid;
    /** 店主为本店某期次指定商品清单（归属校验在外层 resolver）。 */
    setOccurrenceItems(ctx: RequestContext, occId: ID, items: SubscriptionItem[]): Promise<SubscriptionOccurrence>;
    /**
     * 店主为本店某期次指定商品清单（归属隔离强制在业务层）。
     * requireMyShop 拿到店主所属店 → 校验该期次所属订阅的 shopId === 店主所属店，否则 ForbiddenError。
     */
    ownerSetOccurrenceItems(ctx: RequestContext, occId: ID, items: SubscriptionItem[]): Promise<SubscriptionOccurrence>;
    /** 最后一期履约后进入续订待定；买家确认开启新一段（沿用 createSubscription）。 */
    initiateRenewal(ctx: RequestContext, subscriptionId: ID): Promise<Subscription>;
    /** 取消：status → cancelled，并把所有 pending 期次 → cancelled。 */
    cancelSubscription(ctx: RequestContext, subscriptionId: ID): Promise<Subscription>;
    customerSubscriptions(ctx: RequestContext, customerId: number, options?: SubscriptionListOptions): Promise<{
        items: Subscription[];
        totalItems: number;
    }>;
    occurrencesOf(ctx: RequestContext, subscriptionId: ID, options?: SubscriptionListOptions): Promise<{
        items: SubscriptionOccurrence[];
        totalItems: number;
    }>;
    shopPlans(ctx: RequestContext, options?: SubscriptionListOptions): Promise<{
        items: SubscriptionPlan[];
        totalItems: number;
    }>;
    allPlans(ctx: RequestContext, options?: SubscriptionListOptions): Promise<{
        items: SubscriptionPlan[];
        totalItems: number;
    }>;
    /** 平台视角：全部订阅（按 channel 过滤，不按客户）。 */
    allSubscriptions(ctx: RequestContext, options?: SubscriptionListOptions): Promise<{
        items: Subscription[];
        totalItems: number;
    }>;
    /** 平台视角：全部期次（按 channel 过滤，不按客户）。 */
    allOccurrences(ctx: RequestContext, options?: SubscriptionListOptions): Promise<{
        items: SubscriptionOccurrence[];
        totalItems: number;
    }>;
    createPlan(ctx: RequestContext, input: any): Promise<SubscriptionPlan>;
    /** JobQueue handler 入口：对给定 channel 扫一次到期期次。 */
    runDaily(ctx: RequestContext): Promise<{
        created: number;
        skipped: number;
    }>;
    private requireMyShop;
}
