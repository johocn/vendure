import { ID, Injector, ListQueryBuilder, ListQueryOptions, Order, OrderService, PaginatedList, PaymentService, RequestContext, TransactionalConnection } from '@vendure/core';
import { PreSaleActivity } from './pre-sale-activity.entity';
export declare class PreSaleService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private paymentService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, orderService: OrderService, paymentService: PaymentService);
    init(injector: Injector): void;
    findAll(ctx: RequestContext, options?: ListQueryOptions<PreSaleActivity>): Promise<PaginatedList<PreSaleActivity>>;
    findOne(ctx: RequestContext, id: ID): Promise<PreSaleActivity | undefined>;
    create(ctx: RequestContext, input: Partial<PreSaleActivity>): Promise<PreSaleActivity>;
    update(ctx: RequestContext, input: any): Promise<PreSaleActivity>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /**
     * 到货：active → delivered。
     * 到货即开启尾款窗口（deposit 模式把 tailStartAt 落到 releaseAt）。
     */
    deliverPreSale(ctx: RequestContext, id: ID): Promise<PreSaleActivity>;
    /**
     * 抢购一体：
     * 1. 取当前登录用户的 activeOrder（校验归属：order.customer.user.id === ctx.activeUserId）
     * 2. 校验活动：存在、status=active、窗口内、未售罄
     * 3. 校验订单含预售变体行；qty = 预售变体行总件数
     * 4. 限购校验：同客户该活动非取消订单累计预售件数 + qty <= limitPerUser
     * 5. 原子锁定库存（防超卖）：DB UPDATE soldCount+=qty WHERE soldCount+qty<=totalStock；失败即售罄
     * 6. 写订单 customFields（preSaleActivityId + mode + depositTotal + releaseAt 快照）+ 若 presalePrice>0 重算价格打折
     * 7. soldCount >= totalStock → 活动即时置 ended
     */
    applyPreSale(ctx: RequestContext, activityId: ID): Promise<Order>;
    /**
     * 全款预售：一次收清。
     * 校验订单已绑活动 + mode=full + 窗口内 → 创建 Settled 全款 Payment。
     * 注：全额支付覆盖总额后，default-payment-process 会自动把订单流转到 PaymentSettled，
     * 这里不再手动 transition（否则会报 from PaymentSettled to PaymentSettled）。
     */
    payPreSaleFull(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
    /**
     * 定金预售：付定金。
     * 校验状态 ArrangingPayment + mode=deposit + 窗口内 → 创建 Settled 定金 Payment。
     * 定金不覆盖总价，default-payment-process 不会自动流转，因此手动转 Deposited。
     */
    payPreSaleDeposit(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
    /**
     * 定金预售：付尾款。
     * 校验状态 Deposited + mode=deposit + 活动已到货 + 尾款窗口内 → 创建 Settled 尾款 Payment。
     * 定金+尾款覆盖总额后 default-payment-process 自动流转到 PaymentSettled，无需手动 transition。
     */
    payPreSaleTail(ctx: RequestContext, orderId: ID, method: string): Promise<Order>;
    findActive(ctx: RequestContext): Promise<PreSaleActivity[]>;
    /**
     * 订单取消时按订单内预售行实际件数回滚锁定库存。
     */
    releaseStockForOrder(ctx: RequestContext, orderId: ID): Promise<void>;
    /**
     * 校验订单已绑定预售活动，并返回重载后的订单（含 lines.productVariant）。
     */
    private requirePreSaleOrder;
    /**
     * 校验订单关联活动存在且处于可支付窗口（active/delivered + 窗口内）。
     */
    private requireActiveActivity;
    /**
     * 创建一笔已 Settled 的指定金额 Payment 并挂到订单。
     * 指定金额由调用方给出（定金=depositTotal，尾款=剩余，全款=totalWithTax），
     * 不走原生 addPaymentToOrder（那是一次收全额剩余，无法表达定金中间态）。
     */
    private createSettledPayment;
    /**
     * 订单状态转移（幂等失败抛出）。
     */
    private transition;
    private reload;
    /** 已 Settled 支付累计金额 */
    private settledCovered;
    /**
     * 限购校验：同客户该活动非取消订单累计预售件数 + 本次 qty <= limitPerUser。
     */
    private assertPurchaseLimit;
    /**
     * 原子锁定库存：DB UPDATE soldCount += qty
     * WHERE id = ? AND soldCount + qty <= totalStock；受影响=0 即售罄。
     */
    private reserveStock;
    /**
     * 订单取消时原子回滚锁定库存。WHERE soldCount - qty >= 0 防负数。
     * 回滚后若活动曾因售罄置 ended、仍在窗口内且未占满，恢复为 active。
     */
    private releaseStockAtomic;
    private restoreActiveIfPossible;
}
