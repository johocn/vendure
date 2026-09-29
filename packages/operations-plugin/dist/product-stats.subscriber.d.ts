import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, RequestContextService } from '@vendure/core';
import { ProductStatsService } from './product-stats.service';
/**
 * @description
 * 后台改动即时生效：运营改完 bonusSales / pointsRewardOverride，或改完变体价格后，
 * 立刻重算该商品的展示值，不必等次日定时任务。
 *
 * 自激防护：ProductStatsService 写前比对，值无变化则不写库、不发事件，循环最多一轮即终止。
 */
export declare class ProductStatsSubscriber implements OnApplicationBootstrap {
    private eventBus;
    private productStatsService;
    private requestContextService;
    constructor(eventBus: EventBus, productStatsService: ProductStatsService, requestContextService: RequestContextService);
    onApplicationBootstrap(): void;
    private recomputeForProduct;
}
