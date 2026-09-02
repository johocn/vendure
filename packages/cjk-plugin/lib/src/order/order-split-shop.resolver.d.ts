import { ID, Order, RequestContext } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { OrderSplitService } from './order-split.service';
/**
 * 拆单结算入口（统一结算）。内部按所选支付方式聚合拆合并逐单结算：
 * - 选余额 → 全部箱并入 1 单（Path A，一次余额扣款）；
 * - 选非余额且各箱可选方式交集含所选方式 → 并入 1 单（台账另行分账）；
 * - 选非余额且不在交集 → 一律按箱全拆，每配送档案一单。
 * boxKeys/lineIds 可选：限定只结算部分箱 / 箱内部分行；未传则结算全部箱与行，
 * 未选中的行「回流购物车」留在源活动订单。
 * 返回「已各自结算」的订单列表（方法内部逐单 addPaymentToOrder）。
 */
export declare class OrderSplitShopResolver {
    private orderService;
    private orderSplitService;
    constructor(orderService: OrderService, orderSplitService: OrderSplitService);
    private resolveActiveOrder;
    checkoutSplitted(ctx: RequestContext, method: string, metadata?: string, boxKeys?: ID[], lineIds?: ID[]): Promise<Order[]>;
    private parseMetadata;
}
