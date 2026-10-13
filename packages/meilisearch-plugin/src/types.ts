export interface MeiliPluginOptions {
    host: string; // http://127.0.0.1:7700
    adminKey: string; // master key
    indexPrefix: string; // 'kb'
    locales: string[]; // ['zh', 'en']
    reindexUrl?: string; // Strapi 管理路由
    sharedSecret?: string;
}

export interface KbDocument {
    id: string;
    type: string;
    sourceId: string;
    sourceSystem: 'vendure' | 'strapi';
    url: string;
    channelId: string;
    status: string;
    tags: string[];
    title: string;
    body: string;
    updatedAt: number;
    price?: number;
    collectionIds?: string[];
    slug?: string;
}

export interface MeiliIndexStatus {
    index: string;
    documents: number;
    healthy: boolean;
}
