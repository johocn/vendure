// e:\code\vendure\packages\operations-plugin\src\content.service.ts
import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { IsNull } from 'typeorm';

import { ContentType } from './constants';
import { ContentItem } from './entities/content-item.entity';

@Injectable()
export class ContentService {
    constructor(private connection: TransactionalConnection) {}

    // ===== CRUD =====

    async createContentItem(
        ctx: RequestContext,
        input: {
            type: string;
            code: string;
            name: string;
            position?: string;
            sort?: number;
            startAt?: Date;
            endAt?: Date;
            data?: any;
        },
    ): Promise<ContentItem> {
        // Validate type
        const type = this.validateType(input.type);
        // Validate data structure
        this.validateDataByType(type, input.data);
        // Validate code uniqueness (among non-deleted)
        const existing = await this.connection
            .getRepository(ctx, ContentItem)
            .findOne({ where: { code: input.code, deletedAt: IsNull() } });
        if (existing) {
            throw new UserInputError(`Content item code '${input.code}' already exists in this channel`);
        }
        const item = new ContentItem({
            type,
            code: input.code,
            name: input.name,
            enabled: true,
            sort: input.sort ?? 0,
            position: input.position ?? 'home',
            startAt: input.startAt,
            endAt: input.endAt,
            data: input.data,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : undefined,
        } as any);
        return this.connection.getRepository(ctx, ContentItem).save(item);
    }

    async updateContentItem(
        ctx: RequestContext,
        id: ID,
        input: {
            name?: string;
            enabled?: boolean;
            sort?: number;
            position?: string;
            startAt?: Date;
            endAt?: Date;
            data?: any;
        },
    ): Promise<ContentItem> {
        const item = await this.findOneContentItem(ctx, id);
        if (!item) {
            throw new UserInputError('Content item not found');
        }
        if (input.name !== undefined) item.name = input.name;
        if (input.enabled !== undefined) item.enabled = input.enabled;
        if (input.sort !== undefined) item.sort = input.sort;
        if (input.position !== undefined) item.position = input.position;
        if (input.startAt !== undefined) item.startAt = input.startAt;
        if (input.endAt !== undefined) item.endAt = input.endAt;
        if (input.data !== undefined) {
            this.validateDataByType(item.type, input.data);
            item.data = input.data;
        }
        return this.connection.getRepository(ctx, ContentItem).save(item);
    }

    async deleteContentItem(ctx: RequestContext, id: ID): Promise<boolean> {
        const item = await this.findOneContentItem(ctx, id);
        if (!item) {
            throw new UserInputError('Content item not found');
        }
        item.deletedAt = new Date();
        item.deletedBy = ctx.activeUserId ? String(ctx.activeUserId) : undefined;
        await this.connection.getRepository(ctx, ContentItem).save(item);
        return true;
    }

    async findContentItems(
        ctx: RequestContext,
        options: {
            type?: string;
            position?: string;
            enabled?: boolean;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ items: ContentItem[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, ContentItem)
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL');

        if (options.type) {
            qb.andWhere('content.type = :type', { type: options.type });
        }
        if (options.position) {
            qb.andWhere('content.position = :position', { position: options.position });
        }
        if (options.enabled !== undefined) {
            qb.andWhere('content.enabled = :enabled', { enabled: options.enabled });
        }
        qb.orderBy('content.sort', 'ASC').addOrderBy('content.createdAt', 'DESC');

        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneContentItem(ctx: RequestContext, id: ID): Promise<ContentItem | null> {
        return this.connection
            .getRepository(ctx, ContentItem)
            .findOne({ where: { id: id as any, deletedAt: IsNull() } });
    }

    // ===== shop-api public query (only published content) =====

    async findPublishedContentItems(
        ctx: RequestContext,
        options: { type?: string; position?: string },
    ): Promise<ContentItem[]> {
        const qb = this.connection
            .getRepository(ctx, ContentItem)
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.publishedAt IS NOT NULL');

        if (options.type) {
            qb.andWhere('content.type = :type', { type: options.type });
        }
        if (options.position) {
            qb.andWhere('content.position = :position', { position: options.position });
        }

        const now = new Date();
        qb.andWhere('(content.startAt IS NULL OR content.startAt <= :now)', { now });
        qb.andWhere('(content.endAt IS NULL OR content.endAt > :now)', { now });
        qb.orderBy('content.sort', 'ASC');

        return qb.getMany();
    }

    // ===== Validation =====

    private validateType(type: string): ContentType {
        const validTypes = Object.values(ContentType);
        if (!validTypes.includes(type as ContentType)) {
            throw new UserInputError(`Invalid content type: ${type}. Must be one of ${validTypes.join(', ')}`);
        }
        return type as ContentType;
    }

    private validateDataByType(type: ContentType, data: any): void {
        if (!data) {
            throw new UserInputError(`Invalid data for type '${type}': data is required`);
        }
        switch (type) {
            case ContentType.Banner:
                if (!data.imageUrl) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'imageUrl'`);
                }
                break;
            case ContentType.Recommendation:
                if (!data.itemType) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'itemType'`);
                }
                if (!data.itemId) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'itemId'`);
                }
                break;
            case ContentType.Notice:
                if (!data.content) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'content'`);
                }
                break;
            case ContentType.Floor:
                if (!data.title) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'title'`);
                }
                if (!data.layout) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'layout'`);
                }
                if (!Array.isArray(data.items)) {
                    throw new UserInputError(`Invalid data for type '${type}': missing required field 'items' (array)`);
                }
                break;
        }
    }

    // ===== Auto online/offline (called by ScheduledTask) =====

    async runLifecycleCheck(ctx: RequestContext): Promise<{ published: number; unpublished: number }> {
        const repo = this.connection.getRepository(ctx, ContentItem);
        const now = new Date();
        let published = 0;
        let unpublished = 0;

        // Publish: enabled=true AND startAt <= now AND publishedAt IS NULL AND deletedAt IS NULL
        const toPublish = await repo
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.startAt IS NOT NULL')
            .andWhere('content.startAt <= :now', { now })
            .andWhere('content.publishedAt IS NULL')
            .getMany();
        for (const item of toPublish) {
            try {
                item.publishedAt = now;
                await repo.save(item);
                published++;
            } catch (e: any) {
                Logger.error(`Failed to publish content ${item.id}: ${e.message}`, 'OperationsContentService');
            }
        }

        // Unpublish: enabled=true AND endAt <= now AND unpublishedAt IS NULL AND deletedAt IS NULL
        const toUnpublish = await repo
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.endAt IS NOT NULL')
            .andWhere('content.endAt <= :now', { now })
            .andWhere('content.unpublishedAt IS NULL')
            .getMany();
        for (const item of toUnpublish) {
            try {
                item.enabled = false;
                item.unpublishedAt = now;
                await repo.save(item);
                unpublished++;
            } catch (e: any) {
                Logger.error(`Failed to unpublish content ${item.id}: ${e.message}`, 'OperationsContentService');
            }
        }

        return { published, unpublished };
    }
}
