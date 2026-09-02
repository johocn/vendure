import { ID, Order, RequestContext } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { MerchantSplit, OrderBox, OrderBoxService } from './order-box.service';
export declare class OrderBoxShopResolver {
    private orderService;
    private orderBoxService;
    constructor(orderService: OrderService, orderBoxService: OrderBoxService);
    /** 解析当前活动订单（兼容匿名与登录用户，同 PickupShopResolver 模式） */
    private resolveActiveOrder;
    /**
     * 返回当前订单的分箱结果，供前端「按箱展示配送」使用。
     * 每箱含：生效配送档案、落入 lineIds、可用配送方式、可用自提点，
     * 以及（新增）每箱行明细 lines、可用优惠券、配送费/免邮折扣、箱小计、租户名。
     * 通过关系装载补充 shippingLines / customer / productVariant.product（供按箱金额与券范围判定）。
     */
    orderBoxes(ctx: RequestContext): Promise<OrderBox[]>;
    /**
     * 返回当前订单按租户（商户）拆分的结算金额（各箱 subtotal 之和）。
     * 新增 Top-level Query，不改动 orderBoxes 现有结构。
     */
    orderMerchantSplit(ctx: RequestContext): Promise<MerchantSplit[]>;
    /**
     * 为某一箱设置配送方式（自提类可同时传 pickupLocationId）。
     * 将该箱 lines 关联到对应 ShippingLine；所有箱一起核心结算，前端按箱各调一次。
     */
    setOrderBoxShippingMethod(ctx: RequestContext, boxKey: string, shippingMethodId: ID, pickupLocationId?: ID): Promise<Order>;
}
