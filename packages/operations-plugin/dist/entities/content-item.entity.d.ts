import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { ContentType } from '../constants';
/**
 * @description
 * Single-table polymorphism entity for CMS content (Banner/Recommendation/Notice/Floor).
 * Soft delete via deletedAt field; all queries must filter `deletedAt IS NULL`.
 *
 * Note: No database-level @Unique constraint because PostgreSQL/MariaDB treat NULL values
 * as distinct in UNIQUE constraints, which would allow duplicate codes among active rows.
 * Uniqueness is enforced at the application layer in ContentService.createContentItem.
 */
export declare class ContentItem extends VendureEntity {
    constructor(input?: DeepPartial<ContentItem>);
    type: ContentType;
    code: string;
    name: string;
    enabled: boolean;
    sort: number;
    position: string;
    startAt?: Date;
    endAt?: Date;
    data?: any;
    staffId?: string;
    publishedAt?: Date;
    unpublishedAt?: Date;
    deletedAt?: Date;
    deletedBy?: string;
    channels: Channel[];
}
