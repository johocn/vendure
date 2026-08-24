import { PaymentMethodService, RequestContextService, ShippingMethodService, TransactionalConnection } from '@vendure/core';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { ShippingTemplateService } from '../shipping/shipping-template.service';
import { PaymentTemplateService } from '../payment/payment-template.service';
/**
 * 租户内置角色模板（单一来源）。前 20 官方租户 seed 与后续新建租户均从模板生成角色，
 * 避免权限清单多处漂移。数据仍落成每租户独立的 Role（符合 Vendure 按 channel 授权），
 * 仅角色「定义」收敛为一处，改一处全局生效。
 */
export interface RoleTemplate {
    key: 'tenant-admin' | 'sales' | 'stock';
    busiPrefix: string;
    description: string;
    permissions: string[];
}
export declare const OFFICIAL_ROLE_TEMPLATES: RoleTemplate[];
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
    private paymentTemplateService;
    constructor(connection: TransactionalConnection, requestContextService: RequestContextService, shippingMethodService: ShippingMethodService, paymentMethodService: PaymentMethodService, shippingTemplateService: ShippingTemplateService, shippingProfileService: ShippingProfileService, paymentProfileService: PaymentProfileService, paymentTemplateService: PaymentTemplateService);
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
    /** 自提点配送全局模板（固定运费，租户引用后在实例上配 shippingPrice） */
    private seedPickupPointTemplate;
    /** 职工单位自提配送全局模板（固定运费） */
    private seedEmployeePickupTemplate;
    /** 同城快递配送全局模板（固定运费） */
    private seedLocalDeliveryTemplate;
    /** 邮寄配送全局模板（阶梯重量/件数计费） */
    private seedMailTemplate;
    private shippingTemplateExists;
    /** 货到付款支付全局模板 */
    private seedCashOnDeliveryPaymentTemplate;
    /** 余额支付全局模板 */
    private seedBalancePayPaymentTemplate;
    private paymentTemplateExists;
    /** 聚合码支付全局模板（租户可在全局方案池「引用到本店」） */
    private seedAggregatePaymentTemplate;
    /**
     * 幂等创建前 20 个官方自营租户（tenantNo 1-20，isOfficial=true）。
     * 每个租户：3 个内置角色（租户管理员/销售/库存）+ 默认管理员 admin
     *            + 门店自提配送方式 + 门店收银支付方式（复用全局 handler）。
     * 已存在（按 channel.code 判重）则跳过。
     */
    private seedOfficialTenants;
    /** 延迟加载 Vendure 核心实体，避免 seed 阶段循环依赖 */
    private ensureCoreEntities;
    private createTenantRoleRecord;
    private hashPassword;
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
export declare const PICKUP_POINT_TEMPLATE_CODE = "pickup-point-template";
export declare const EMPLOYEE_PICKUP_TEMPLATE_CODE = "employee-pickup-template";
export declare const LOCAL_DELIVERY_TEMPLATE_CODE = "local-delivery-template";
export declare const MAIL_TEMPLATE_CODE = "mail-template";
export declare const STORE_PICKUP_PROFILE_CODE = "store-pickup-profile";
export declare const CASHIER_PAYMENT_METHOD_CODE = "cash-on-delivery";
export declare const CASHIER_PAYMENT_PROFILE_CODE = "store-cashier-profile";
export declare const COD_PAYMENT_TEMPLATE_CODE = "cod-payment-template";
export declare const BALANCE_PAY_TEMPLATE_CODE = "balance-pay-template";
export declare const AGGREGATE_PAYMENT_TEMPLATE_CODE = "aggregate-pay";
