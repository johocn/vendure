import { ModuleRef } from '@nestjs/core';
import { ID, ListQueryBuilder, ListQueryOptions, Order, OrderService, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { InstallmentPlan } from './installment-plan.entity';
import { InstallmentPluginOptions } from './types';
export declare class InstallmentService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private moduleRef;
    private options;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, orderService: OrderService, moduleRef: ModuleRef, options: InstallmentPluginOptions);
    private repo;
    findAll(ctx: RequestContext, options?: ListQueryOptions<InstallmentPlan>): Promise<PaginatedList<InstallmentPlan>>;
    findByVariant(ctx: RequestContext, variantId: ID): Promise<InstallmentPlan[]>;
    findOne(ctx: RequestContext, id: ID): Promise<InstallmentPlan | undefined>;
    create(ctx: RequestContext, input: Partial<InstallmentPlan>): Promise<InstallmentPlan>;
    update(ctx: RequestContext, input: any): Promise<InstallmentPlan>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    private get defaultGraceHours();
    /**
     * 结算页启用分期：校验归属/状态/无既有期次 → 生成期次实例。
     * 注：RequestContext 无 injector 属性（本仓 Vendure 3.6 实装），
     * 经注入的 ModuleRef 构造 Injector（同 PaymentSchedulePlugin.onApplicationBootstrap 手法）。
     */
    enableInstallment(ctx: RequestContext, orderId: ID, planId: ID): Promise<Order>;
    /** 参数硬校验（设计 §5：首付比 0-90 / 期数 1-36） */
    private assertValid;
}
