import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { ServiceVoucher } from './service-voucher.entity';
import { VoucherService } from './voucher.service';

/** C 端券接口：登录顾客查询自己的到店服务券。 */
@Resolver()
export class VoucherShopResolver {
    constructor(private service: VoucherService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myVouchers(@Ctx() ctx: RequestContext): Promise<ServiceVoucher[]> {
        return this.service.myVouchers(ctx);
    }
}