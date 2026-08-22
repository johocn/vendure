import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 发票抬头（单位抬头资料），C端保存/复用/设默认。
 * 归属：customerId（Vendure 本地 userId），多租户经 channels 隔离。
 */
@Entity()
export class InvoiceTitle extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<InvoiceTitle>) {
        super(input);
    }

    /** 单位/个人抬头名称 */
    @Column({ type: 'text' }) title: string;

    @Column({ type: 'varchar', nullable: true }) taxNumber: string | null;

    @Column({ type: 'varchar', nullable: true }) email: string | null;

    @Column({ type: 'varchar', nullable: true }) companyAddress: string | null;

    @Column({ type: 'varchar', nullable: true }) companyPhone: string | null;

    @Column({ type: 'varchar', nullable: true }) bankName: string | null;

    @Column({ type: 'varchar', nullable: true }) bankAccount: string | null;

    /** 归属用户（C端本地 userId） */
    @Column() customerId: number;

    /** 是否为该用户的默认抬头 */
    @Column({ type: 'boolean', default: false }) isDefault: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}