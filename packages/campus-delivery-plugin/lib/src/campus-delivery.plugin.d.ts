import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { CampusConfigService } from './campus-config.service';
import { HallService } from './hall.service';
import { PaymentTimeoutJob } from './payment-timeout.job';
import { CampusNotifyService } from './campus-notify.service';
import { R4TagService } from './r4-tag.service';
export declare class CampusDeliveryPlugin implements OnApplicationBootstrap {
    private eventBus;
    private hallService;
    private r4TagService;
    private moduleRef;
    private notify;
    private paymentTimeout;
    private configService;
    constructor(eventBus: EventBus, hallService: HallService, r4TagService: R4TagService, moduleRef: ModuleRef, notify: CampusNotifyService, paymentTimeout: PaymentTimeoutJob, configService: CampusConfigService);
    /** vendure Injector 需由 ModuleRef 构造（插件模块类构造器不直接提供 Injector） */
    private get injector();
    onApplicationBootstrap(): void;
    /** h5BaseUrl 取渠道配置（未配置返回 undefined，通知静默不带 url） */
    private h5BaseUrl;
}
