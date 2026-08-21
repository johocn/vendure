import { Column, Entity, ManyToOne } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { OperationSection } from './operation-section.entity';

/**
 * 专区条目。
 * type: banner（图/文案/跳转）/ product（关联 core Product）/ link（纯链接）。
 * sortOrder 条目内排序（升序）。imageAssetId 关联 core Asset，productId 关联 core Product。
 */
@Entity()
export class OperationItem extends VendureEntity {
    constructor(input?: DeepPartial<OperationItem>) {
        super(input);
    }

    @ManyToOne(() => OperationSection, section => section.items)
    section: OperationSection;

    @Column({ type: 'int' })
    sectionId: number;

    @Column({ type: 'varchar' })
    type: string;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @Column({ type: 'varchar', nullable: true })
    title: string | null;

    @Column({ type: 'int', nullable: true })
    imageAssetId: number | null;

    @Column({ type: 'varchar', nullable: true })
    linkUrl: string | null;

    @Column({ type: 'int', nullable: true })
    productId: number | null;

    @Column({ type: 'int' })
    channelId: number;
}