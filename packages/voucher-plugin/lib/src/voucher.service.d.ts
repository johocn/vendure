import { AdministratorService, ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';
import { VoucherPluginOptions } from './voucher.options';
import { ServiceVoucher } from './service-voucher.entity';
import { VoucherBooking } from './voucher-booking.entity';
export declare class VoucherService {
    private options;
    private connection;
    private orderService;
    private administratorService;
    constructor(options: VoucherPluginOptions, connection: TransactionalConnection, orderService: OrderService, administratorService: AdministratorService);
    /** 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。 */
    requireMyShop(ctx: RequestContext): Promise<Shop>;
    /**
     * 幂等生成：按 orderId 查 ServiceVoucher，存在即返回；否则遍历订单行，仅对
     * 「Product.customFields.serviceType 非空」的服务型商品每件生成一张券（阶段22 铁律：
     * OrderLine 无私货 productId，须走 line.productVariant.product）。
     */
    getOrCreateVouchersForOrder(ctx: RequestContext, order: Order): Promise<ServiceVoucher[]>;
    /** 核销：店主在其店内找 code 对应券，usable → used+usedAt。 */
    redeemVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher>;
    /** 扫码展示：店主在其店内按 code 查回，未命中返回 undefined。 */
    findVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher | undefined>;
    /** 延期：used 不可延，expiresAt += days。 */
    extendVoucher(ctx: RequestContext, voucherId: ID, days: number): Promise<ServiceVoucher>;
    /** 换券：旧券置 voided，新建同信息新券（新 code，status usable，expiresAt 重置）。 */
    exchangeVoucher(ctx: RequestContext, voucherId: ID): Promise<ServiceVoucher>;
    /** 过期扫描：usable 且 expiresAt < now → expired。返回处理条数（JobQueue/admin mutation 调用）。 */
    markExpired(_ctx: RequestContext): Promise<number>;
    /** 退款成功联动：该单全部 usable 券 → refunded+refundedAt（RefundStateTransitionEvent Settled 订阅调用）。 */
    markRefundedOnOrder(ctx: RequestContext, orderId: ID): Promise<number>;
    /** 建预约（幂等：一券最多一档）。 */
    createBooking(ctx: RequestContext, voucherId: ID, slotAt: Date | string, customerCount: number): Promise<VoucherBooking>;
    /** 查询某券的预约档。 */
    bookingsForVoucher(ctx: RequestContext, voucherId: ID): Promise<VoucherBooking[]>;
    /** C 端当前顾客券列表：customerId = activeUserId 对应用户的 Customer（按 customer.user.id 关联）。 */
    myVouchers(ctx: RequestContext): Promise<ServiceVoucher[]>;
    /** 管理端全局券列表（本 channel）。 */
    vouchers(ctx: RequestContext): Promise<ServiceVoucher[]>;
    private pickName;
    /** 保证唯一核销码：时间戳+随机，冲突重试。 */
    private genUniqueCode;
}
