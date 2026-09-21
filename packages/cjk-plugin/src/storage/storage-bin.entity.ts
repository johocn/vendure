import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity('storage_bin')
@Unique(['tenantChannelId', 'stockLocationId', 'code'])
export class StorageBin extends VendureEntity {
    constructor(input?: DeepPartial<StorageBin>) {
        super(input);
    }

    @Index()
    @Column({ type: 'varchar' })
    tenantChannelId!: string;

    @Index()
    @Column({ type: 'integer' })
    stockLocationId!: number;

    @Column({ type: 'integer' })
    zoneId!: number;

    /** 完整库位编码，如 A-01-03 */
    @Column({ type: 'varchar' })
    code!: string;

    /** 货架号。排序用数字，避免 A-10 < A-2 的字符串排序坑 */
    @Column({ type: 'integer', default: 0 })
    rowNo!: number;

    /** 层号 */
    @Column({ type: 'integer', default: 0 })
    levelNo!: number;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;
}