// d:\zhao\vendure\packages\operations-plugin\src\product-stats.subscriber.ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    ID,
    Logger,
    ProductEvent,
    ProductVariantEvent,
    RequestContextService,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { ProductStatsService } from './product-stats.service';

/**
 * @description
 * 后台改动即时生效：运营改完 bonusSales / pointsRewardOverride，或改完变体价格后，
 * 立刻重算该商品的展示值，不必等次日定时任务。
 *
 * 自激防护：ProductStatsService 写前比对，值无变化则不写库、不发事件，循环最多一轮即终止。
 */
@Injectable()
export class ProductStatsSubscriber implements OnApplicationBootstrap {
    constructor(
        private eventBus: EventBus,
        private productStatsService: ProductStatsService,
        private requestContextService: RequestContextService,
    ) {}

    onApplicationBootstrap(): void {
        this.eventBus.ofType(ProductEvent).subscribe(event => {
            if (event.type !== 'created' && event.type !== 'updated') {
                return;
            }
            void this.recomputeForProduct(event.entity.id);
        });

        this.eventBus.ofType(ProductVariantEvent).subscribe(event => {
            if (event.type !== 'created' && event.type !== 'updated' && event.type !== 'deleted') {
                return;
            }
            const productId = (event.entity as any).productId;
            void this.recomputeForProduct(productId);
        });
    }

    private async recomputeForProduct(productId: ID | undefined): Promise<void> {
        if (productId == null) {
            return;
        }
        try {
            // 用新建的非事务 ctx：事件可能在事务中发出，复用事件 ctx 会把重算卷进该事务。
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            await this.productStatsService.recomputeForProducts(ctx, [productId]);
        } catch (err: any) {
            Logger.error(`Product stats recompute failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
