import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponPluginOptions } from './types';
export declare class CouponPlugin implements OnApplicationBootstrap {
    private options;
    private couponService;
    private eventBus;
    private static options;
    constructor(options: CouponPluginOptions, couponService: CouponService, eventBus: EventBus);
    static init(options?: CouponPluginOptions): Type<CouponPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
