import { ChannelService, CustomerService, ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
/** 需要登录才能使用的支付方式 code 集合（余额钱包依赖账户身份，游客结算时应被过滤）。 */
export declare const LOGIN_REQUIRED_PAYMENT_CODES: ReadonlySet<string>;
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
    /** 该箱可用配送方式详情（含译名），供前端渲染方法名称，不依赖 eligibleShippingMethods */
    availableShippingMethods: Array<{
        id: ID;
        code: string;
        name: string;
    }>;
    /** 该箱默认配送方式 id（可用集合中第一个），用于未显式选择时的兜底 */
    defaultShippingMethodId: ID | null;
    /** 该箱允许的自提点集合 */
    pickupLocations: PickupLocation[];
    /** 该箱可用支付方式 code 集合（来自配送档案绑定的支付档案，供聚合拆合引擎用） */
    availablePaymentMethodCodes: string[];
    /** 该箱可用支付方式中需要登录才能使用的 code 集合（如余额钱包），供前端游客结算过滤 */
    loginRequiredPaymentCodes: string[];
    /** 该箱是否需要收货地址（物流档案=true） */
    requiresAddress: boolean;
    /** 该箱是否需要联系方式（到店需联系方式档案=true） */
    requiresContact: boolean;
    /** 该箱落入的 OrderLine 明细（含商品名、含税单价、含税行小计），供前端按箱展示商品 */
    lines: OrderBoxLine[];
    /** 该箱当前可用（未使用/回退）且满足该箱范围的优惠券，供前端按箱选券 */
    availableCoupons: BoxCouponInfo[];
    /** 本箱配送费（含税），非免邮时 > 0 */
    shippingCost: number;
    /** 本箱免邮券等折扣额（正值） */
    shippingDiscount: number;
    /** 本箱小计 = max(0, 商品合计(含税) - 券抵扣 + shippingCost - shippingDiscount) */
    subtotal: number;
    /** 租户名，由 tenantChannelId 解析 Channel.name（兜底 Channel.code / id） */
    tenantName: string;
}
/** 装箱明细行（Additive，新增字段） */
export interface OrderBoxLine {
    orderLineId: string;
    productVariantId: string;
    productName: string;
    /** 含税单价 */
    unitPrice: number;
    quantity: number;
    /** 含税行小计 >= 0 */
    lineTotal: number;
}
/** 某箱可用优惠券摘要（Additive，新增字段） */
export interface BoxCouponInfo {
    /** 券码 */
    code: string;
    /** 券名（多语言按 ctx 语言取，无则原值） */
    name: string;
    /** 展示条件文案（简短） */
    condition: string;
    /** 对「本箱」的最大可抵扣金额（正值）；免邮券则近似为可抵扣的运费 */
    amount: number;
}
/** 商户（租户）结算拆分结果（新增 Top-level Query orderMerchantSplit） */
export interface MerchantSplit {
    tenantChannelId: ID;
    tenantName: string;
    amount: number;
}
export declare class OrderBoxService {
    private shippingProfileService;
    private paymentProfileService;
    private orderService;
    private channelService;
    private customerService;
    private connection;
    constructor(shippingProfileService: ShippingProfileService, paymentProfileService: PaymentProfileService, orderService: OrderService, channelService: ChannelService, customerService: CustomerService, connection: TransactionalConnection);
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
     * 商户（租户）结算拆分：按 tenantChannelId 聚合各箱 subtotal，
     * 返回每租户应结算金额。可复用 computeOrderBoxes（含已算好的 subtotal / tenantName）。
     */
    computeMerchantSplit(ctx: RequestContext, order: Order): Promise<MerchantSplit[]>;
    /** 预加载订单内所有 Channel 的 name/code（跨所有箱共用的租户名解析，均以 id 为 key），失败时返回空 Map。 */
    private loadChannelsNameMap;
    /** 解析当前订单的客户 id（优先 order.customer，否则由 activeUserId 查 Customer）。 */
    private resolveCustomerId;
    /** 加载某客户的全部券（含 template），失败（coupon-plugin 未注册等）时返回空数组，不影响订单分箱主流程。 */
    private loadCustomerCoupons;
    /** 加载订单当前应用（customFields.couponCode）的券实例，失败时返回 undefined。 */
    private loadAppliedCoupon;
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
