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
