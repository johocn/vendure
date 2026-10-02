import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CouponSaleOrder } from './coupon-sale-order.entity';
import { CouponBundle, CouponBundleItem } from './coupon-bundle.entity';
import { WechatpayService } from '@vendure/wechatpay-plugin';
export declare function setCouponSaleGateway(gw: WechatpayService | null): void;
/**
 * 出售链路编排：独立券商城（微信 / 余额）+ 加价购 + 退款回收。
 * 所有金额单位为「分」。订单/券的最终发放在 CouponService 内完成，本服务只做编排与状态机。
 */
export declare class CouponSaleService {
    private connection;
    private couponService;
    private customerService;
    constructor(connection: TransactionalConnection, couponService: CouponService, customerService: CustomerService);
    /** 当前请求的 customerId */
    private currentCustomerId;
    /** 券商城目录：可售模板（渠道含 SALE 且 salePrice>0）+ 启用券包 */
    saleCatalogue(ctx: RequestContext, scene?: string): Promise<{
        templates: CouponTemplate[];
        bundles: CouponBundle[];
    }>;
    /** 创建出售单（路径 A）：校验渠道含 SALE / 可售 / 未售罄，落 PENDING 单 */
    createSaleOrder(ctx: RequestContext, templateId?: ID | null, bundleId?: ID | null): Promise<CouponSaleOrder>;
    /** 余额支付（同步结算）：扣余额 → 置 PAID → 发券 */
    paySaleOrderWithBalance(ctx: RequestContext, id: ID): Promise<CouponSaleOrder>;
    /** 生成微信支付参数（仅本人 PENDING 单），镜像 recharge-card 的 RC- 范式 */
    createWechatCouponPayment(ctx: RequestContext, saleOrderId: ID, tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP', openid?: string): Promise<any>;
    /** 微信回调结算入口：解析 CS-<id>，原子置 PAID 后发券（幂等） */
    settleCouponSaleOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void>;
    /** 取消未支付出售单 */
    cancelSaleOrder(ctx: RequestContext, id: ID): Promise<CouponSaleOrder>;
    /**
     * 退款回收（路径 A：微信 / 余额）：券全部未使用才可退。
     * 回收券（INVALID）+ 单据 REFUNDED + 余额补偿（微信/余额支付均已入客户余额，见 §16-2 决策）。
     */
    refundSaleOrder(ctx: RequestContext, id: ID, reason?: string): Promise<CouponSaleOrder>;
    /** 我的出售单 */
    mySaleOrders(ctx: RequestContext): Promise<CouponSaleOrder[]>;
    /**
     * 商品页加价购：把券价作为 Surcharge 挂到主订单，落 PENDING 出售单。
     * orderId 必须是本人的活动订单。同一 orderId + templateId 只允许一条 PENDING。
     */
    attachCouponToOrder(ctx: RequestContext, orderId: ID, templateId: ID, orderService: any): Promise<CouponSaleOrder>;
    /** 摘除加价购：移除 Surcharge + 置 CANCELLED */
    detachCouponFromOrder(ctx: RequestContext, orderId: ID, templateId: ID, orderService: any): Promise<boolean>;
    /**
     * 主订单支付成功 → 结算全部 PENDING 加价购单（幂等）。
     * 由 plugin.ts 订阅 OrderStateTransitionEvent(toState='PaymentSettled') 调用。
     */
    settleSurchargeOrdersForOrder(ctx: RequestContext, orderId: ID): Promise<void>;
    /**
     * 主订单整单退款/取消 → 回收加价购券并置 REFUNDED（钱随主订单退回，不做余额补偿）。
     */
    refundSurchargeOrdersForOrder(ctx: RequestContext, orderId: ID): Promise<void>;
    listBundles(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<{
        items: CouponBundle[];
        totalItems: number;
    }>;
    findBundle(ctx: RequestContext, id: ID): Promise<CouponBundle | undefined>;
    listBundleItems(ctx: RequestContext, bundleId: ID): Promise<CouponBundleItem[]>;
    /** 创建/更新券包（仅管理当前渠道） */
    saveBundle(ctx: RequestContext, input: any, id?: ID): Promise<CouponBundle>;
    deleteBundle(ctx: RequestContext, id: ID): Promise<boolean>;
    /** admin 出售单流水（列表 + 单查） */
    listSaleOrders(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        status?: string;
    }): Promise<{
        items: CouponSaleOrder[];
        totalItems: number;
    }>;
    findSaleOrder(ctx: RequestContext, id: ID): Promise<CouponSaleOrder | undefined>;
    private loadSaleableTemplate;
    private loadSaleableBundle;
    private assertBundleStock;
    private loadOwnedPendingOrder;
    private loadSaleCoupons;
    /** 结算 + 发券（自带事务；供余额支付与加价购复用） */
    private settleSaleOrderWithTx;
    /** 余额支付：已在事务内的结算（避免嵌套问题，直接发券） */
    private settleSaleOrder;
    /** 按出售单发券：单券 1 张 / 券包按 item 展开逐张签发 */
    private issueCouponsForOrder;
    private invalidateCoupons;
}
