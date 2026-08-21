import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LiveRoomService } from './live-room.service';
import { LiveRoomShopService } from './live-room-shop.service';
import { LiveCommissionService } from './live-commission.service';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveStreamingPlugin implements OnApplicationBootstrap {
    private options;
    private liveRoomService;
    private liveRoomShopService;
    private liveCommissionService;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: LiveStreamingPluginOptions, liveRoomService: LiveRoomService, liveRoomShopService: LiveRoomShopService, liveCommissionService: LiveCommissionService, moduleRef: ModuleRef);
    static init(options?: LiveStreamingPluginOptions): Type<LiveStreamingPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
