import { ID, Injector, ListQueryBuilder, ListQueryOptions, OrderService, PaginatedList, PaymentService, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderPaymentSchedule } from './order-payment-schedule.entity';
import { OrderScheduleItem } from './order-schedule-item.entity';
import { DepositRule, ItemKind, ScheduleStatus, ScheduleTrigger } from './schedule-config';
export interface CreateScheduleItemInput {
    seq: number;
    kind: ItemKind;
    amount: number;
    allowCod?: boolean;
    trigger: ScheduleTrigger;
    graceHours?: number;
    lateFeeRule?: {
        dailyRate: number;
    } | null;
}
export interface CreateScheduleInput {
    orderId: ID;
    scenario: 'presale' | 'installment' | 'rental';
    deliveryGate: 'all_paid' | 'first_period' | 'deposit_paid';
    depositRule?: DepositRule | null;
    agreementVersion: string;
    shipDeadline?: Date | null;
    /** 场景扩展快照（租赁买断等），原样落库到实体 meta 列 */
    meta?: Record<string, unknown> | null;
    items: CreateScheduleItemInput[];
}
export interface ScheduleWithItems {
    schedule: OrderPaymentSchedule;
    items: OrderScheduleItem[];
}
export declare class PaymentScheduleService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private paymentService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, orderService: OrderService, paymentService: PaymentService);
    init(_injector: Injector): void;
    private scheduleRepo;
    private itemRepo;
    private findItems;
    private orderWithPayments;
    private assertOrderOwner;
    createSchedule(ctx: RequestContext, input: CreateScheduleInput): Promise<OrderPaymentSchedule>;
    /** 追加期次（租赁买断场景；调度须为 rental 且尚无买断项） */
    addScheduleItem(ctx: RequestContext, scheduleId: number, input: {
        kind: ItemKind;
        amount: number;
        trigger?: ScheduleTrigger;
    }): Promise<ScheduleWithItems>;
    getScheduleForOrder(ctx: RequestContext, orderId: ID, opts?: {
        requireOwner?: boolean;
    }): Promise<ScheduleWithItems | null>;
    getScheduleById(ctx: RequestContext, scheduleId: number | null, opts?: {
        requireOwner?: boolean;
    }): Promise<ScheduleWithItems | null>;
    listSchedules(ctx: RequestContext, options?: ListQueryOptions<OrderPaymentSchedule>): Promise<PaginatedList<OrderPaymentSchedule>>;
    /** GraphQL 呈现（滞纳金/已付统计现算，不落库） */
    presentSchedule(withItems: ScheduleWithItems, now?: Date): {
        items: {
            trigger: ScheduleTrigger;
            paidAmount: number;
            lateFeeAccrued: number;
            scheduleId: number;
            seq: number;
            kind: ItemKind;
            amount: number;
            allowCod: boolean;
            dueAt: Date | null;
            graceHours: number;
            lateFeeRule: import("./schedule-config").LateFeeRule | null;
            status: import("./schedule-config").ItemStatus;
            paidAt: Date | null;
            paymentId: number | null;
            groupBuyActivityId: number | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        }[];
        paidTotal: number;
        totalAmount: number;
        orderId: number;
        channelId: number;
        scenario: import("./schedule-config").ScheduleScenario;
        deliveryGate: import("./schedule-config").DeliveryGate;
        depositRule: DepositRule | null;
        agreementVersion: string;
        status: ScheduleStatus;
        breachType: import("./schedule-config").ScheduleBreachType | null;
        shipDeadline: Date | null;
        meta: Record<string, unknown> | null;
        channels: import("@vendure/core").Channel[];
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    };
    /** Admin 列表批量取期次（供 resolver 组装 present） */
    findItemsForPresent(ctx: RequestContext, scheduleId: number): Promise<OrderScheduleItem[]>;
    /**
     * 付任意期次（在线/COD 均经此）。
     * Settled → item paid + 推进订单状态；Authorized（COD handler）→ item 留待 confirmCodReceived。
     */
    paySchedulePeriod(ctx: RequestContext, orderId: ID, seq: number, method: string): Promise<ScheduleWithItems>;
    /** locked 期次在支付时刻补偿触发（补偿扫描任务最长 1 分钟延迟）：date 到点 / interval 到点 */
    private unlockByTrigger;
    private afterItemPaymentRecorded;
    /** COD 环收尾：签收后管理员确认 → settle 授权支付 → item paid → 可能 PaymentSettled */
    confirmCodReceived(ctx: RequestContext, orderId: ID): Promise<ScheduleWithItems>;
    /**
     * 买家主动取消：
     * - legal_deposit：须 confirmForfeit=true，定金没收（forfeited），其余已付期次全退
     * - earnest：按 earnestRefundPolicy 退（默认全额）
     * - 其他（首付/押金语义）：已付期次全退
     * 未支付期次 → waived；调度 → cancelled；订单 → Cancelled（库存经各插件 Cancelled 订阅释放）。
     */
    cancelSchedule(ctx: RequestContext, orderId: ID, confirmForfeit: boolean): Promise<ScheduleWithItems>;
    private channelScheduleIds;
    /** 触发扫描：locked → payable（date 到点 / interval 到点 / group_buy 活动完成或失败） */
    processTriggers(ctx: RequestContext, now?: Date): Promise<{
        activated: number;
        failedSchedules: number;
    }>;
    /** group_buy 触发器：软依赖团购活动状态（completed→解锁；expired/过期→按不成团处理） */
    private handleGroupBuyTrigger;
    private findGroupBuyActivity;
    /** 团购不成团：已付期次全额原路退，未付 → waived，调度 breached(group_buy_failed)，订单取消 */
    failSchedulesForGroupBuy(ctx: RequestContext, activityId: number, now?: Date): Promise<number>;
    /** 事件入口：团购成团（事件与扫描双通道，事件先行即时解锁） */
    handleGroupBuyCompleted(ctx: RequestContext, activityId: number): Promise<number>;
    /** 事件入口：团购失败 */
    handleGroupBuyFailed(ctx: RequestContext, activityId: number): Promise<number>;
    /** 逾期扫描：payable 超 dueAt+graceHours → overdue + 违约动作（仅作用于本次转 overdue 期） */
    processOverdue(ctx: RequestContext, now?: Date): Promise<{
        overdue: number;
        cancelledOrders: number;
    }>;
    /** 违约矩阵（设计 §7）——只对逾期期执行 */
    private applyBreachAction;
    /** 发货超期扫描：超过发货承诺未发货 → 标记 seller_breach 待管理员确认 */
    processShipDeadlines(ctx: RequestContext, now?: Date): Promise<number>;
    /**
     * 卖家违约确认（管理员）：
     * - legal_deposit 定金：双倍返还（本金 refund + 等额赔偿 refund，两笔留痕）
     * - 其余已付期次：全额退
     * 未付期次 → waived；调度 → cancelled；订单取消。
     */
    confirmSellerBreach(ctx: RequestContext, scheduleId: number): Promise<ScheduleWithItems>;
    /** 手动开启尾款窗口（manual/group_buy 期次 → payable） */
    openTailWindow(ctx: RequestContext, scheduleId: number): Promise<ScheduleWithItems>;
    /** 租赁还物退押（管理员）：押金期已付 → 全额原路退 → refunded */
    releaseDepositForRental(ctx: RequestContext, orderId: ID): Promise<ScheduleWithItems>;
    handleOrderCancelled(ctx: RequestContext, orderId: ID): Promise<void>;
    private readOrderScheduleId;
    private notifyTailOpened;
    private transition;
    private cancelOrderSafe;
    /** 原路退（Vendure PaymentService.createRefund；shipping/adjustment 为 NOT NULL 必须显式置 0） */
    private refundPayment;
    /** 幂等退款：已 Settled 退款合计 + 本次 > 支付额 时拒绝（防团购与调度双通道重复退款） */
    private refundPaymentOnce;
}
