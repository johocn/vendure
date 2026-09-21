import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('storage_zone')
@Unique(['tenantChannelId', 'stockLocationId', 'code'])
export class StorageZone extends VendureEntity {
    constructor(input?: DeepPartial<StorageZone>) {
        super(input);
    }

    @Index()
    @Column({ type: 'varchar' })
    tenantChannelId!: string;

    @Index()
    @Column({ type: 'integer' })
    stockLocationId!: number;

    /** 库区字母，如 A */
    @Column({ type: 'varchar' })
    code!: string;

    /** 库区名称，如「常温存储区」 */
    @Column({ type: 'varchar' })
    name!: string;

    /** 拣货顺序，A→B→C→D */
    @Column({ type: 'integer', default: 0 })
    sortOrder!: number;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;
}