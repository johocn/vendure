import { CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { CustomerBalance } from './customer-balance.entity';
import { BalanceTransaction, BalanceTransactionType } from './balance-transaction.entity';
import { RechargeOrder } from './recharge-order.entity';
import { WechatpayService } from '@vendure/wechatpay-plugin';
export declare function setWechatpayGateway(gw: WechatpayService | null): void;
export declare class RechargeCardService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    /**
     * Unifies the customer identity across all balance entry points.
     * Given an explicit `customerId`, returns it directly. Otherwise resolves
     * the Customer.id from the active session's User.id via customerService.
     * This fixes the prior mix of User.id (consumption/recharge) and
     * Customer.id (refund) keys that fragmented a single account's balance.
     */
    private resolveCustomerId;
    getBalance(ctx: RequestContext, customerId?: any): Promise<number>;
    addBalance(ctx: RequestContext, customerId: any, amount: number, orderId?: ID | null, paymentId?: ID | null, type?: BalanceTransactionType): Promise<number>;
    deductBalance(ctx: RequestContext, customerId: any, amount: number, orderId?: ID | null, paymentId?: ID | null): Promise<number>;
    createRechargeOrder(ctx: RequestContext, amount: number, remark?: string): Promise<RechargeOrder>;
    payRechargeOrder(ctx: RequestContext, id: ID): Promise<RechargeOrder>;
    cancelRechargeOrder(ctx: RequestContext, id: ID): Promise<RechargeOrder>;
    findMyRechargeOrders(ctx: RequestContext): Promise<RechargeOrder[]>;
    /** 在线充值：生成微信支付参数并在充值单回写支付方式（仅本人 pending 单） */
    createWechatRechargePayment(ctx: RequestContext, rechargeOrderId: ID, tradeType?: string, openid?: string): Promise<any>;
    /** 网关回调结算入口：解析 RC-<id>，原子入账（admin ctx 无 activeUser，用单归属 customerId 显式入账） */
    settleRechargeOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void>;
    redeemCard(ctx: RequestContext, code: string, pin?: string): Promise<RechargeCard>;
    findMyCards(ctx: RequestContext): Promise<RechargeCard[]>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<RechargeCard>): Promise<PaginatedList<RechargeCard>>;
    findAllBatches(ctx: RequestContext, options?: ListQueryOptions<RechargeCardBatch>): Promise<PaginatedList<RechargeCardBatch>>;
    createBatch(ctx: RequestContext, input: {
        name: string;
        prefix?: string;
        faceValue: number;
        quantity: number;
        expiresAt?: Date;
    }): Promise<RechargeCardBatch>;
    freezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard>;
    unfreezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard>;
    /**
     * Applies an atomic balance change and records a BalanceTransaction.
     * Must be called within an already-started transaction.
     * `delta` > 0 adds balance, `delta` < 0 deducts (with sufficiency check).
     * Returns the balance after the change.
     */
    private applyBalanceChange;
    adminAdjustBalance(ctx: RequestContext, input: {
        customerId: ID;
        amount: number;
        type: BalanceTransactionType;
        remark?: string;
    }): Promise<number>;
    myBalanceTransactions(ctx: RequestContext, options?: ListQueryOptions<BalanceTransaction>): Promise<PaginatedList<BalanceTransaction>>;
    customerBalances(ctx: RequestContext, options?: ListQueryOptions<CustomerBalance>): Promise<PaginatedList<CustomerBalance>>;
    customerBalanceTransactions(ctx: RequestContext, customerId: ID, options?: ListQueryOptions<BalanceTransaction>): Promise<PaginatedList<BalanceTransaction>>;
    isRechargeOrderPaid(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 该订单是否已用余额 `balance-pay` 扣过款（Authorization 防重复扣减用） */
    isOrderBalancePaid(ctx: RequestContext, orderId: ID): Promise<boolean>;
    /** 该订单通过余额累计划扣的金额（分）；createRefund 上限依据 */
    getOrderBalanceConsumed(ctx: RequestContext, orderId: ID): Promise<number>;
}
