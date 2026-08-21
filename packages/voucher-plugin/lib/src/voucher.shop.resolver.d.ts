import { RequestContext } from '@vendure/core';
import { ServiceVoucher } from './service-voucher.entity';
import { VoucherService } from './voucher.service';
/** C 端券接口：登录顾客查询自己的到店服务券。 */
export declare class VoucherShopResolver {
    private service;
    constructor(service: VoucherService);
    myVouchers(ctx: RequestContext): Promise<ServiceVoucher[]>;
}
