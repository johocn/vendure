import { Column, DeleteDateColumn, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { ChannelAware, Channel, DeepPartial, EntityId, HasCustomFields, ID, VendureEntity } from '@vendure/core';

class CustomPickupLocationFields {}

@Entity()
@Index(['merchantStoreId'])
export class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'varchar', default: 'store' })
    type: 'store' | 'point' | 'employee';

    /** own=门店自提（自带库存，取件即扣）；remote=远程自提（需仓→自提点配送） */
    @Column({ type: 'varchar', default: 'own' })
    stockType: string;

    @Column() address: string;

    @Column({ nullable: true }) contactPerson: string;

    @Column({ nullable: true }) phoneNumber: string;

    @Column({ nullable: true }) businessHours: string;

    @Column({ type: 'simple-json', nullable: true })
    coordinates: { lat: number; lng: number } | null;

    @Column({ nullable: true }) partner: string;

    @Column({ type: 'simple-json', nullable: true })
    photos: string[] | null;

    @Column({ type: 'text', nullable: true }) remark: string | null;

    @Column({ default: 0 }) sortOrder: number;

    @Column({ default: true }) enabled: boolean;

    @Column({ type: 'varchar', nullable: true }) province: string | null;
    @Column({ type: 'varchar', nullable: true }) city: string | null;
    @Column({ type: 'varchar', nullable: true }) district: string | null;
    @Column({ type: 'varchar', nullable: true }) street: string | null;

    @Column({ default: false }) isPublic: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    /**
     * 关联门店 ID（merchant-plugin 的 merchant_store）。
     * 不建外键、不引入 MerchantStore 实体，避免两个插件互相依赖；存在性由服务层校验。
     * 历史数据由 create-merchant-tables 迁移按 type=store 回填。
     */
    @EntityId({ nullable: true })
    merchantStoreId: ID | null;

    /** 软删时间：删除仅置该字段，历史订单/配送档案对自提点的引用仍可解析 */
    @DeleteDateColumn({ nullable: true })
    deletedAt: Date | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomPickupLocationFields)
    customFields: CustomPickupLocationFields;
}
