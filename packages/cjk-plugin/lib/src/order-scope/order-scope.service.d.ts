import { Order, RelationPaths, RequestContext, TransactionalConnection } from '@vendure/core';
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
    /** 窗口内最大 createdAt（ISO），无单为 null——游标与计数同轴（见 newOrderSignal 注释） */
    latestCreatedAt: string | null;
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
    /**
     * @param relations 由 resolver 的 @Relations(Order) 装饰器按 GraphQL selection 计算（含 Calculated
     * 字段依赖，如 totalQuantity → lines）。与原生 listQueryBuilder 同机制：setFindOptions +
     * relationLoadStrategy:'query'，一对多关系走独立子查询，避免 join 一对多 + take 分页错乱；
     * 未加载 lines 时 GraphQL 序列化 totalQuantity 会抛 InternalServerError（实体 getter 防御）。
     */
    scopedOrders(ctx: RequestContext, filter: ScopedOrderFilter, take: number, skip: number, relations?: RelationPaths<Order>): Promise<ScopedOrderList>;
    /** N 组计数（每条独立 QB，参数互不冲突）；异常向上抛由前端保留旧值 */
    scopedOrderCounts(ctx: RequestContext, filters: ScopedOrderFilter[]): Promise<number[]>;
    /**
     * 新单信号：since 之后建单数 + 窗口内最大 createdAt
     *
     * 游标同轴铁律（2026-10-12 修复重复播报）：计数谓词与游标必须同用 createdAt 轴——
     * 此前游标取 MAX(orderPlacedAt)（下单轴）两轴脱节：未付款单 orderPlacedAt 为 null，
     * 窗口内只有未付款单时前端游标不前进 → 每 30s 重播横幅+语音且 unread 无限累加；
     * 窗口内有付款单时，建单时间晚于该单 orderPlacedAt 的未付款单也会每轮重复计数。
     * 同轴后 MAX(createdAt) ≥ 一切已计数单的 createdAt，严格大于天然排除（含未付款单）。
     *
     * 时区口径（dev 实测定性，勿改回 toISOString() 字符串传参）：
     * 列形态为 timestamp without time zone 且存本地字面（本地 17:40 建单 → 列字面 2026-10-11 17:40:39）。
     * since 以 Date 对象直传：pg 驱动按连接时区序列化为「本地字面+偏移」（实测 2026-10-11T09:40:39.209Z
     * → '2026-10-11T17:40:39.209+08:00'），PG 解析时丢偏移取字面 = 本地日历字面，与列字面对齐；
     * 若传 toISOString() 字符串则被丢 Z 按 UTC 字面比较 → 窗口整体早 8h → 同批单反复命中。
     * 谓词用严格大于：排除「构成上次锚点的最后一单」（含等于会让 count 恒多 1，前端 unread 重复累加）。
     */
    newOrderSignal(ctx: RequestContext, since: Date): Promise<NewOrderSignal>;
}
