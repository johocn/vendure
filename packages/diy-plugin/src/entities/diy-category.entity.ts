import { VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

import { LocalizedText } from '../types';

/** DIY 分类：单表两层，app=null 平台分类（全局可见），非空=租户自建（并集，无覆盖） */
@Entity()
export class DiyCategory extends VendureEntity {
    constructor(input?: Partial<DiyCategory>) {
        super(input);
    }

    @Column({ type: 'varchar', nullable: true })
    app: string | null;

    /** slug：crystal/agate/wood/amber/pearl/metal/gemstone；槽位 filter.categoryCodes 按它过滤 */
    @Column({ type: 'varchar', nullable: true })
    code: string | null;

    @Column({ type: 'int', nullable: true })
    parentId: number | null;

    @Column('simple-json')
    name: LocalizedText;

    @Column({ type: 'varchar', nullable: true })
    image: string | null;

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ default: true })
    enabled: boolean;
}
