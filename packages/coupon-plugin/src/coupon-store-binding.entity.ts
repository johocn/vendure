import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 券模板 ↔ 门店绑定（券可用门店范围）。
 * - type=INCLUDE：可用门店白名单
 * - type=EXCLUDE：在无 INCLUDE 或 INCLUDE 命中后进一步排除的门店
 * 无任何绑定行时视为不限门店（storeCoverage='ALL'），历史券行为完全不变。
 * templateId 可空（预留券包 bundleId 维度），故组合索引不做唯一约束。
 */
@Entity()
@Index(['templateId', 'storeId'])
export class CouponStoreBinding extends VendureEntity {
    constructor(input?: DeepPartial<CouponStoreBinding>) {
        super(input);
    }

    /** 券模板 id（券包维度绑定时可空） */
    @Index()
    @Column({ type: 'int', nullable: true })
    templateId: number | null;

    /** 券包 id（预留） */
    @Column({ type: 'int', nullable: true })
    bundleId: number | null;

    /** 门店所属商户 id（merchant-plugin 提供，冗余便于按商户聚合） */
    @Column({ type: 'int', nullable: true })
    merchantId: number | null;

    /** 门店 id（merchant-plugin MerchantStore.id） */
    @Index()
    @Column({ type: 'int' })
    storeId: number;

    /** 绑定类型：INCLUDE（可用）/ EXCLUDE（排除） */
    @Column('varchar', { default: 'INCLUDE' })
    type: 'INCLUDE' | 'EXCLUDE';

    /** 优先级（预留展示排序） */
    @Column({ type: 'int', default: 0 })
    priority: number;

    /** 是否默认门店（预留） */
    @Column('boolean', { default: false })
    isDefault: boolean;

    /** 所属渠道（多租户隔离） */
    @Column({ type: 'int' })
    channelId: number;
}
