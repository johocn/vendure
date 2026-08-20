import { Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
export declare class DeliveryGatewayPlugin {
    private optionsToken;
    private deliveryGateway;
    private moduleRef;
    private static options;
    private injector;
    constructor(optionsToken: Record<string, unknown>, deliveryGateway: DeliveryGatewayService, moduleRef: ModuleRef);
    static init(options?: Record<string, unknown>): Type<DeliveryGatewayPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
