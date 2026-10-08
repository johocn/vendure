import { ModuleRef } from '@nestjs/core';
import { ID, ListQueryBuilder, ListQueryOptions, Order, OrderService, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { RentalPlan } from './rental-plan.entity';
import { RentalPluginOptions } from './types';
export declare class RentalService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private moduleRef;
    private options;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, orderService: OrderService, moduleRef: ModuleRef, options: RentalPluginOptions);
    private repo;
    findAll(ctx: RequestContext, options?: ListQueryOptions<RentalPlan>): Promise<PaginatedList<RentalPlan>>;
    findByVariant(ctx: RequestContext, variantId: ID): Promise<RentalPlan[]>;
    findOne(ctx: RequestContext, id: ID): Promise<RentalPlan | undefined>;
    create(ctx: RequestContext, input: Partial<RentalPlan>): Promise<RentalPlan>;
    update(ctx: RequestContext, input: any): Promise<RentalPlan>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    private get defaultGraceHours();
    /**
     * 结算页选择租赁：校验归属/状态/含对应商品行 → 生成期次实例（押金 + 租金）。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 installment 场景手法）。
     */
    startRental(ctx: RequestContext, orderId: ID, planId: ID, periods: number): Promise<Order>;
    /**
     * 租期付清后的所有权买断：按下单快照买断价扣除已付租金，追加 buyout 期次（payable，date now）。
     * 买断款随后经 paySchedulePeriod 支付——调度被 addScheduleItem 拉回 in_progress，
     * 订单处于 PaymentSettled 也可付（PAYABLE_SOURCE_STATES 含 PaymentSettled，见 Task 4）。
     */
    buyoutRental(ctx: RequestContext, orderId: ID): Promise<{
        scheduleId: number;
        seq: number;
        amount: number;
    }>;
    /** 参数硬校验（押金/租金必须为正；买断价可为 null 但不可为负） */
    private assertValid;
}
