import { PaymentMethodService, RequestContextService, ShippingMethodService, TransactionalConnection } from '@vendure/core';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { ShippingTemplateService } from '../shipping/shipping-template.service';
/**
 * 插件默认数据初始化
 *
 * 商品级配送/支付方案（ShippingProfile/PaymentProfile）建表后为空。
 * 本服务在 onApplicationBootstrap 阶段幂等创建一套全局默认数据，便于快速投入使用：
 * - 自提点（门店）
 * - 门店自提配送方式 + 配送模板 + 配送档案
 * - 门店收银支付方式 + 支付档案
 *
 * 默认数据均为全局档案（isGlobal=true），所有租户共享。
 * 通过 CjkPlugin.options.seedDefaultData = false 可禁用。
 */
export declare class DefaultDataService {
    private connection;
    private requestContextService;
    private shippingMethodService;
    private paymentMethodService;
    private shippingTemplateService;
    private shippingProfileService;
    private paymentProfileService;
    constructor(connection: TransactionalConnection, requestContextService: RequestContextService, shippingMethodService: ShippingMethodService, paymentMethodService: PaymentMethodService, shippingTemplateService: ShippingTemplateService, shippingProfileService: ShippingProfileService, paymentProfileService: PaymentProfileService);
    /**
     * 幂等创建默认数据。任何单项失败仅记日志，不阻塞应用启动。
     */
    seed(): Promise<void>;
    /** 默认门店自提点 */
    private seedPickupLocation;
    /** 门店自提配送方式 */
    private seedStorePickupMethod;
    /** 门店自提配送模板 */
    private seedStorePickupTemplate;
    /** 门店自提配送档案（关联配送方式 + 自提点） */
    private seedStorePickupProfile;
    /** 门店收银支付方式（货到付款处理器） */
    private seedCashierPaymentMethod;
    /** 门店收银支付档案 */
    private seedCashierPaymentProfile;
}
export declare const DEFAULT_STORE: {
    name: string;
    type: "store";
    address: string;
    phoneNumber: string;
    businessHours: string;
};
export declare const STORE_PICKUP_METHOD_CODE = "store-pickup";
export declare const STORE_PICKUP_TEMPLATE_CODE = "store-pickup-template";
export declare const STORE_PICKUP_PROFILE_CODE = "store-pickup-profile";
export declare const CASHIER_PAYMENT_METHOD_CODE = "cash-on-delivery";
export declare const CASHIER_PAYMENT_PROFILE_CODE = "store-cashier-profile";
