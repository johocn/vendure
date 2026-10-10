import { Injector, Order, OrderInterceptor, OrderLine, RequestContext } from '@vendure/core';
import type { WillAddItemToOrderInput, WillAdjustOrderLineInput } from '@vendure/core';
export declare class HotelOrderInterceptor implements OrderInterceptor {
    private inventory;
    init(injector: Injector): void;
    /**
     * 加购：酒店行 → 重锁该（订单 × 房型 × 本次日期段）。
     * 同段旧行（core 会把本次累加到它）的 hold 一并重置，目标量 = 旧行数量 + 本次新增；
     * 行尚未创建，落锁 orderLineId=null（adjust/confirm 时回填）。
     */
    willAddItemToOrder(ctx: RequestContext, order: Order, input: WillAddItemToOrderInput): Promise<void | string>;
    /**
     * 改行（数量/日期）：酒店行 → 先重置本行旧 hold 再按目标量锁新段（同事务，失败整体回滚）。
     * customFields 为 undefined（纯改数量）时沿用行上日期。
     */
    willAdjustOrderLine(ctx: RequestContext, order: Order, input: WillAdjustOrderLineInput): Promise<void | string>;
    /** 移除行：酒店行 → 释放该行全部锁 + 该段内的 orderLineId=null 孤儿锁（同事务随行删除回滚对称） */
    willRemoveItemFromOrder(ctx: RequestContext, order: Order, orderLine: OrderLine): Promise<void | string>;
    private toInterceptorError;
}
