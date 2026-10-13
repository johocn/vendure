import { MeiliService } from '../meili.service';
import { ProductSyncService } from '../product-sync.service';
import { MeiliIndexStatus } from '../types';
export type MeiliReindexScope = 'PRODUCTS' | 'CONTENTS' | 'ALL';
export declare class MeiliAdminResolver {
    private meili;
    private sync;
    constructor(meili: MeiliService, sync: ProductSyncService);
    meiliIndexStats(): Promise<MeiliIndexStatus[]>;
    /**
     * 手动重建入口：CONTENTS/ALL 触发 Strapi 内容域全量（未配置 reindexUrl/sharedSecret 时返回 false 不报错）；
     * PRODUCTS/ALL 入队商品域全量重建 job（失败由 retries 兜底）。本 mutation 不写库。
     */
    meiliReindex(scope: MeiliReindexScope): Promise<{
        queued: boolean;
        contentsTriggered: boolean;
    }>;
}
