// e:\code\vendure\packages\operations-plugin\src\entities\content-item.entity.ts
import { Channel, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

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
@Entity()
export class ContentItem extends VendureEntity {
    constructor(input?: DeepPartial<ContentItem>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    type: ContentType;

    @Index()
    @Column()
    code: string;

    @Column()
    name: string;

    @Column({ default: true })
    enabled: boolean;

    @Index()
    @Column({ default: 0 })
    sort: number;

    @Index()
    @Column({ default: 'home' })
    position: string;

    @Column({ nullable: true })
    startAt?: Date;

    @Column({ nullable: true })
    endAt?: Date;

    // Use 'json' (not 'jsonb') for cross-database compatibility (dev default is MariaDB)
    @Column({ type: 'json', nullable: true })
    data?: any;

    @Column({ nullable: true })
    staffId?: string;

    @Column({ nullable: true })
    publishedAt?: Date;

    @Column({ nullable: true })
    unpublishedAt?: Date;

    @Index()
    @Column({ nullable: true })
    deletedAt?: Date;

    @Column({ nullable: true })
    deletedBy?: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
