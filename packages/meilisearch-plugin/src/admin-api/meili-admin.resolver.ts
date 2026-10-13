import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Permission, Transaction } from '@vendure/core';

import { MeiliService } from '../meili.service';
import { ProductSyncService } from '../product-sync.service';
import { MeiliIndexStatus } from '../types';

export type MeiliReindexScope = 'PRODUCTS' | 'CONTENTS' | 'ALL';

@Resolver()
export class MeiliAdminResolver {
    constructor(private meili: MeiliService, private sync: ProductSyncService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async meiliIndexStats(): Promise<MeiliIndexStatus[]> {
        // Meili 不可用时降级为空列表，不阻塞管理页
        const healthy = await this.meili.health();
        return healthy ? this.meili.stats() : [];
    }

    /**
     * 手动重建入口：CONTENTS/ALL 触发 Strapi 内容域全量（未配置 reindexUrl/sharedSecret 时返回 false 不报错）；
     * PRODUCTS/ALL 入队商品域全量重建 job（失败由 retries 兜底）。本 mutation 不写库。
     */
    @Mutation()
    @Transaction()
    @Allow(Permission.SuperAdmin)
    async meiliReindex(
        @Args('scope') scope: MeiliReindexScope,
    ): Promise<{ queued: boolean; contentsTriggered: boolean }> {
        let contentsTriggered = false;
        if (scope === 'CONTENTS' || scope === 'ALL') {
            contentsTriggered = await this.meili.triggerContentReindex();
        }
        let queued = false;
        if (scope === 'PRODUCTS' || scope === 'ALL') {
            await this.sync.enqueue(undefined);
            queued = true;
        }
        return { queued, contentsTriggered };
    }
}
