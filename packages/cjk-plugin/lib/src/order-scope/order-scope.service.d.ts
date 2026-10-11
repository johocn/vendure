import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { RedeemScope } from '@vendure/coupon-plugin';
import { RedeemScopeService } from '../tenant/redeem-scope.service';
/** 前端语义过滤入参（时间为已解析的半开区间） */
export interface ScopedOrderFilter {
    states?: string[];
    /** createdAt >= start（ISO，含） */
    timeStart?: string;
    /** createdAt < end（ISO，不含） */
    timeEnd?: string;
    keyword?: string;
    deliveryType?: string;
    exceptionType?: string;
    exceptionOnly?: boolean;
    afterSales?: string[];
}
export interface ScopedOrderList {
    totalItems: number;
    items: Order[];
}
export interface NewOrderSignal {
    count: number;
    /** 过滤范围内最大 orderPlacedAt（ISO），无单为 null */
    latestPlacedAt: string | null;
}
/**
 * 受限核销员「按配送档案」的订单查询/计数/新单信号服务。
 *
 * 范围判定：超管恒不受限；其余复用 RedeemScopeService（持有 VerifyOrder
 * 权限 → 以 TenantMember.shippingProfileIds 为白名单）。受限时要求订单
 * 所有商品行的 productVariant.customFields.shippingProfileId 都落在白名单
 * 内（任一行缺失或越界 → 整单排除；无行订单排除），与
 * RedeemScopeService.orderInScope 语义一致，只是下推为 QB 谓词。
 */
export declare class OrderScopeService {
    private connection;
    private redeemScopeService;
    constructor(connection: TransactionalConnection, redeemScopeService: RedeemScopeService);
    /** 超管恒不受限；其余复用 RedeemScopeService（VerifyOrder → 白名单） */
    resolveScope(ctx: RequestContext): Promise<RedeemScope>;
    /** 受限：叠加「全部行档案 ∈ 白名单」谓词（与 RedeemScopeService.orderInScope 语义一致） */
    private applyScope;
    private applyFilter;
    private baseQb;
    scopedOrders(ctx: RequestContext, filter: ScopedOrderFilter, take: number, skip: number): Promise<ScopedOrderList>;
    /** N 组计数（每条独立 QB，参数互不冲突）；异常向上抛由前端保留旧值 */
    scopedOrderCounts(ctx: RequestContext, filters: ScopedOrderFilter[]): Promise<number[]>;
    /** 新单信号：since 之后下单数 + 范围内最大 orderPlacedAt */
    newOrderSignal(ctx: RequestContext, since: Date): Promise<NewOrderSignal>;
}
