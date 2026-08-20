import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LogisticsPluginOptions } from './types';
import { LogisticsService } from './logistics.service';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderPackageService } from './order-package.service';
export declare class LogisticsPlugin implements OnApplicationBootstrap {
    private options;
    private logisticsService;
    private autoSplit;
    private manualSplit;
    private orderPackageService;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: LogisticsPluginOptions, logisticsService: LogisticsService, autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService, orderPackageService: OrderPackageService, moduleRef: ModuleRef);
    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin>;
    onApplicationBootstrap(): Promise<void>;
    /**
     * 重算拆单订单运费：仅在存在 stockLocationsJson 拆分明细时触发，
     * 使 SplitShippingCalculator 按已落库的每包明细计费并写入 Order.packageShippingJson / shippingWithTax。
     */
    private recalcSplitShipping;
}
