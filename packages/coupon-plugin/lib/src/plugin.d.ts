import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus } from '@vendure/core';
import { CouponService } from './coupon.service';
import { CouponPluginOptions } from './types';
export declare class CouponPlugin implements OnApplicationBootstrap {
    private options;
    private couponService;
    private eventBus;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: CouponPluginOptions, couponService: CouponService, eventBus: EventBus, moduleRef: ModuleRef);
    static init(options?: CouponPluginOptions): Type<CouponPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
