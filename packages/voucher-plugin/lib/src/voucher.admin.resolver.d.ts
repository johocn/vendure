import { ID, RequestContext } from '@vendure/core';
import { VoucherBooking } from './voucher-booking.entity';
import { ServiceVoucher } from './service-voucher.entity';
import { VoucherService } from './voucher.service';
/**
 * 管理端券接口。核销/延期/换券均经 service 层 requireMyShop 校验当前活跃用户为 active 店主
 * （归属隔离由 Shop.administratorId 把关），因此 schema 侧仅需 Authenticated 保底，
 * 真正的授权由 requireMyShop 兜底。
 */
export declare class VoucherAdminResolver {
    private service;
    constructor(service: VoucherService);
    /** 扫码展示：店主按 code 查回本店券。 */
    scanVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher | undefined>;
    /** 管理端全局券列表（本 channel）。 */
    myVouchersAdmin(ctx: RequestContext): Promise<ServiceVoucher[]>;
    /** 某券的预约档。 */
    voucherBookings(ctx: RequestContext, voucherId: ID): Promise<VoucherBooking[]>;
    /** 店主核销：usable → used。 */
    redeemVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher>;
    extendVoucher(ctx: RequestContext, voucherId: ID, days: number): Promise<ServiceVoucher>;
    exchangeVoucher(ctx: RequestContext, voucherId: ID): Promise<ServiceVoucher>;
    /** 创建预约档（幂等：一券一档）。 */
    createBooking(ctx: RequestContext, voucherId: ID, slotAt: Date, customerCount: number): Promise<VoucherBooking>;
    /** 触发过期扫描（或由 JobQueue 定时调用）。 */
    runExpireScan(ctx: RequestContext): Promise<number>;
}
