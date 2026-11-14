import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LogisticsPluginOptions } from './types';
import { LogisticsService } from './logistics.service';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderPackageService } from './order-package.service';
import { OrderCompleteAutoService } from './order-complete-auto.service';
export declare class LogisticsPlugin implements OnApplicationBootstrap {
    private options;
    private logisticsService;
    private autoSplit;
    private manualSplit;
    private orderPackageService;
    private orderCompleteAuto;
    private moduleRef;
    private static options;
    private injector;
    private recalcHandlerRegistered;
    constructor(options: LogisticsPluginOptions, logisticsService: LogisticsService, autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService, orderPackageService: OrderPackageService, orderCompleteAuto: OrderCompleteAutoService, moduleRef: ModuleRef);
    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin>;
    onApplicationBootstrap(): Promise<void>;
    /**
     * 重算拆单订单运费：仅在存在 stockLocationsJson 拆分明细时触发，
     * 使 SplitShippingCalculator 按已落库的每包明细计费并写入 Order.packageShippingJson / shippingWithTax。
     *
     * 注意：本方法作为阻塞事件处理器，在 ArrangingPayment 过渡的事务内执行，且
     * transitionToState 会在本回调之后再次 save 事件里的 order 实体。因此不能另起实例整行 save
     * （会被外层 save 覆盖），而要把重算结果合并回传入的 order 实体，由外层统一落库。
     */
    private recalcSplitShipping;
}
