import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Administrator, Channel, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 租户内部人员关联表：承载「后台人员 × 所属租户」的归属、启停与备注。
 * 后台人员本体仍是 Vendure 原生 Administrator，本表不改原生实体。
 */
@Entity()
export class TenantMember extends VendureEntity {
    constructor(input?: DeepPartial<TenantMember>) {
        super(input);
    }

    @ManyToOne(() => Administrator, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'administrator_id' })
    administrator?: Administrator;

    @Column({ type: 'varchar' })
    administratorId!: string;

    @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'channel_id' })
    channel?: Channel;

    @Column({ type: 'varchar' })
    channelId!: string;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;

    /** 首登强改密：为 true 时该人员在更改密码前只能执行基础/改密操作 */
    @Column({ type: 'boolean', default: false })
    mustChangePassword!: boolean;

    @Column({ type: 'varchar', nullable: true })
    displayName!: string | null;

    @Column({ type: 'text', nullable: true })
    remark!: string | null;

    /** 手机号（选填） */
    @Column({ type: 'varchar', length: 32, nullable: true })
    phone!: string | null;
}
