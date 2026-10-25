export interface MeiliPluginOptions {
    host: string;
    adminKey: string;
    indexPrefix: string;
    locales: string[];
    reindexUrl?: string;
    sharedSecret?: string;
}
export interface KbDocument {
    id: string;
    type: string;
    sourceId: string;
    sourceSystem: 'vendure' | 'strapi';
    url: string;
    /** 主渠道（价格口径） */
    channelId: string;
    /** 商品所属全部渠道（含默认渠道）；商品搜索按该数组过滤 */
    channelIds?: string[];
    status: string;
    tags: string[];
    title: string;
    body: string;
    updatedAt: number;
    price?: number;
    collectionIds?: string[];
    slug?: string;
    /** 商品主图绝对地址（无配置资产域名时省略） */
    thumbnail?: string;
}
export interface MeiliIndexStatus {
    index: string;
    documents: number;
    healthy: boolean;
}
