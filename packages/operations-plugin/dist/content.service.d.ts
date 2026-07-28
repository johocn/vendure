import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ContentItem } from './entities/content-item.entity';
export declare class ContentService {
    private connection;
    constructor(connection: TransactionalConnection);
    createContentItem(ctx: RequestContext, input: {
        type: string;
        code: string;
        name: string;
        position?: string;
        sort?: number;
        startAt?: Date;
        endAt?: Date;
        data?: any;
    }): Promise<ContentItem>;
    updateContentItem(ctx: RequestContext, id: ID, input: {
        name?: string;
        enabled?: boolean;
        sort?: number;
        position?: string;
        startAt?: Date;
        endAt?: Date;
        data?: any;
    }): Promise<ContentItem>;
    deleteContentItem(ctx: RequestContext, id: ID): Promise<boolean>;
    findContentItems(ctx: RequestContext, options: {
        type?: string;
        position?: string;
        enabled?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: ContentItem[];
        totalItems: number;
    }>;
    findOneContentItem(ctx: RequestContext, id: ID): Promise<ContentItem | null>;
    findPublishedContentItems(ctx: RequestContext, options: {
        type?: string;
        position?: string;
    }): Promise<ContentItem[]>;
    private validateType;
    private validateDataByType;
    runLifecycleCheck(ctx: RequestContext): Promise<{
        published: number;
        unpublished: number;
    }>;
}
