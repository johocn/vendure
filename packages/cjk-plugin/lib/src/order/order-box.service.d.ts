import { ID, Order, OrderService, RequestContext } from '@vendure/core';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
/**
 * 订单分箱结果（Box）。
 * 分箱键 = 变体 customFields.shippingProfileId（配送档案）：
 * - 同档案合箱；
 * - 未绑定/已停用档案 → 依据 ShippingProfileService.resolveEffectiveProfileIds 回退到租户默认档案并入其分组。
 */
export interface OrderBox {
    /** 箱的唯一稳定标识（`box:<profileId>`） */
    boxKey: string;
    /** 生效配送档案 id；未解析到任何档案时为 null */
    profileId: ID | null;
    /** 生效配送档案名称 */
    profileName: string;
    /** 落入该箱的 OrderLine id 列表 */
    lineIds: ID[];
    /** 箱型：pickup=自提类，delivery=物流类 */
    type: 'delivery' | 'pickup';
    /** 该箱所在租户渠道 id */
    tenantChannelId: ID;
    /** 落入该箱的原始变体配送档案 id（去重，含回退前的原始绑定） */
    shippingProfileIds: ID[];
    /** 该箱配送档案允许的可用配送方式 id（已过滤停用） */
    availableShippingMethodIds: ID[];
    /** 该箱默认配送方式 id（可用集合中第一个），用于未显式选择时的兜底 */
    defaultShippingMethodId: ID | null;
    /** 该箱允许的自提点集合 */
    pickupLocations: PickupLocation[];
    /** 该箱可用支付方式 code 集合（来自配送档案绑定的支付档案，供聚合拆合引擎用） */
    availablePaymentMethodCodes: string[];
    /** 该箱是否需要收货地址（物流档案=true） */
    requiresAddress: boolean;
    /** 该箱是否需要联系方式（到店需联系方式档案=true） */
    requiresContact: boolean;
}
export declare class OrderBoxService {
    private shippingProfileService;
    private paymentProfileService;
    private orderService;
    constructor(shippingProfileService: ShippingProfileService, paymentProfileService: PaymentProfileService, orderService: OrderService);
    /**
     * 将一个订单的 order lines 按「已生效配送档案」分组为若干箱。
     *
     * 规则（对齐 spec §2.3 / resolveEffectiveProfileIds）：
     * - 变体绑定档案若停用（enabled=false）→ 视为未绑定，回退到租户默认档案；
     * - 变体未绑定任何档案 → 直接回退到租户默认档案；
     * - 同一生效档案的 line 合并为同一箱（跨租户/跨档案自动分箱）。
     */
    computeOrderBoxes(ctx: RequestContext, order: Order): Promise<OrderBox[]>;
    /**
     * 读取订单已保存的分箱选择（boxShippingSelections customField 中的 JSON）。
     * 结构：{ [boxKey]: { shippingMethodId, pickupLocationId } }
     */
    getBoxSelections(order: Order): Record<string, {
        shippingMethodId?: ID;
        pickupLocationId?: ID | null;
    }>;
    private readSelections;
    /**
     * 解析某配送档案可用的支付方式 code 集合（供聚合拆合引擎判定每箱支付白名单）。
     * - 配送档案绑定支付档案 → 用其全部支付方式 code；
     * - 未绑定 → 回退租户默认支付档案。
     */
    resolvePaymentCodesForProfile(ctx: RequestContext, shippingProfileId: ID): Promise<string[]>;
    /** 兼容单箱传入的支付方式白名单解析。 */
    resolvePaymentCodesForBox(ctx: RequestContext, box: Pick<OrderBox, 'profileId'>): Promise<string[]>;
    /**
     * 为订单内一组箱设置配送方式（一次性调核心 setShippingMethod，多 fulfillment）。
     *
     * selections 可选：传入则为各箱配送方式选择快照（用于拆单时把源订单的选择带给新订单）；
     * 未传则读取 order.customFields.boxShippingSelections。每箱未显式选择时用该箱默认配送方式兜底。
     */
    setShippingForOrder(ctx: RequestContext, order: Order, boxKeys: string[], selections?: Record<string, {
        shippingMethodId?: ID;
        pickupLocationId?: ID | null;
    }>): Promise<Order>;
    /**
     * 为某一箱设置配送方式（并把该箱的 lines 通过核心 setShippingMethod 关联到对应 ShippingLine）。
     *
     * 实现了「单订单内多配送组」的统一骨架：
     * - 依据各箱当前选择 + 默认兜底，构造整单配送方式 id 数组，一次调用核心
     *   setShippingMethod（配合 BoxShippingLineAssignmentStrategy，每个 ShippingLine 只挂其箱内 lines）。
     * - pickupLocationId 仅供自提类方式使用，写入该箱选择快照。
     *
     * 注意：核心结算入口是整单级的（eligibility/price 针对整单计算，非该箱 line 子集），
     * 自提（免费/固定价）方式不受影响；阶梯重量/件数等按整单计费的方式无法按箱独立计价，见报告。
     */
    setBoxShippingMethod(ctx: RequestContext, order: Order, boxKey: string, shippingMethodId: ID, pickupLocationId?: ID): Promise<Order>;
}
