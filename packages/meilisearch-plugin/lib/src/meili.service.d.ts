import { KbDocument, MeiliIndexStatus, MeiliPluginOptions } from './types';
export declare class MeiliService {
    private opts;
    constructor(opts: MeiliPluginOptions);
    private req;
    indexUid(locale: string): string;
    ensureIndexes(): Promise<void>;
    upsertDocuments(locale: string, docs: KbDocument[]): Promise<void>;
    /**
     * 商品搜索（shop 侧统一入口）：
     * filter 固定 type=product + status=published，可叠加 channelId；
     * 权重由 ensureIndexes 的 searchableAttributes 决定（title > tags > body）。
     */
    search(locale: string, params: {
        q: string;
        channelId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        hits: KbDocument[];
        total: number;
        processingTimeMs: number;
    }>;
    deleteDocuments(locale: string, ids: string[]): Promise<void>;
    stats(): Promise<MeiliIndexStatus[]>;
    health(): Promise<boolean>;
    triggerContentReindex(): Promise<boolean>;
}
