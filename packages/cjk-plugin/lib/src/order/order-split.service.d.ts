import { ID, Order, OrderService, RequestContext } from '@vendure/core';
import { OrderBoxService } from './order-box.service';
import { MerchantSettlementService } from './merchant-settlement.service';
/**
 * 后端「一次性拆单结算」服务（统一入口，由 checkoutSplitted 调用）。
 *
 * 语义：源活动订单内所有 box 在一个 Order（AddingItems 态）。聚合引擎（decideAggregation）
 * 按所选支付方式决定分组：余额 → 全部箱并 1 组（不拆）；非余额 → 每箱独立成组。
 * groups 头 1 组保留在源订单，其余各组各建新订单，并把对应箱的订单行从源订单迁移到新订单，
 * 最后逐单过渡到 ArrangingPayment 并 addPaymentToOrder。
 *
 * 设计约束：
 * - 由调用方 mutation 保证 @Transaction() 整体原子；任一步失败整体回滚。
 * - 订单行迁移采用「源订单 removeItemsFromOrder + 新订单 addItemsToOrder」按 variant+qty 重建，
 *   箱划分依据为变体级 shippingProfileId，重加后分箱结果一致；行级 customFields 不随迁。
 * - 每单配送方式沿用源订单的箱选择快照，缺失时用该箱默认配送方式兜底。
 */
export declare class OrderSplitService {
    private orderService;
    private orderBoxService;
    private merchantSettlementService;
    constructor(orderService: OrderService, orderBoxService: OrderBoxService, merchantSettlementService: MerchantSettlementService);
    /**
     * 一次性拆单并逐单完成支付，返回需各自结算的订单列表（均已付款结算）。
     *
     * 支持部分结算（return-to-cart）：
     * - 不传 opts（或传了但覆盖全部箱/行）→ 全选，走与旧版完全一致的路径；
     * - 传 boxKeys/lineIds 限定 → 仅结算所选箱/行，未选中的行留在源活动订单（购物车）不结算。
     *
     * @param order 源活动订单（含全部 box 的 lines）
     * @param method 所选支付方式 code（同时驱动聚合判定）
     * @param metadata 支付方式透传 metadata
     * @param options.boxKeys 可选：限定要结算的箱（boxKey）集合
     * @param options.lineIds 可选：在选定箱内进一步限定要结算的行（orderLineId）
     */
    performSplitCheckout(ctx: RequestContext, order: Order, method: string, metadata?: Record<string, any>, options?: {
        boxKeys?: ID[];
        lineIds?: ID[];
    }): Promise<Order[]>;
    /** 校验拆单结算后数量守恒；不等即抛错（依赖调用方 @Transaction 原子回滚）。 */
    private verifyQuantityConservation;
    /** 聚合一个 group 的箱，得到其「被选中」的 order lines 的 variant+qty 列表。 */
    private buildItemsForGroup;
    /** 将 OrderAddress 简单 JSON 映射为 CreateAddressInput（缺省字段省略，交由核心兜底）。 */
    private mapAddress;
}
