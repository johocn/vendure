import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index, Unique } from 'typeorm';

/**
 * SKU–库位绑定。三档开关共表：
 * - bin 档：zoneId + binId 都写
 * - zone 档：只写 zoneId，binId 为 null
 * - off 档：本表不使用（但表始终存在）
 */
@Entity('variant_storage_bin')
@Unique(['tenantChannelId', 'variantId', 'stockLocationId'])
export class VariantStorageBin extends VendureEntity {
    constructor(input?: DeepPartial<VariantStorageBin>) {
        super(input);
    }

    @Index()
    @Column({ type: 'varchar' })
    tenantChannelId!: string;

    @Index()
    @Column({ type: 'integer' })
    variantId!: number;

    @Index()
    @Column({ type: 'integer' })
    stockLocationId!: number;

    /** 必填：zone 档的唯一归属依据 */
    @Column({ type: 'integer' })
    zoneId!: number;

    /** 可空：bin 档必填，zone 档恒为 null */
    @Column({ type: 'integer', nullable: true })
    binId!: number | null;

    @Column({ type: 'boolean', default: true })
    isDefault!: boolean;
}