﻿import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 门店认领关系：租户渠道 × 门店的可选绑定。
 *
 * 与租户 Channel 解耦的边界就在这里——门店本身不挂渠道，渠道通过本表认领门店；
 * 撤销认领只改状态（REVOKED），不物理删除，便于审计与重新认领。
 */
@Entity()
@Index(['storeId', 'channelId'], { unique: true })
export class MerchantStoreChannel extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStoreChannel>) {
        super(input);
    }

    @Column({ type: 'int' }) storeId: number;

    @Column({ type: 'int' }) channelId: number;

    /** 关系角色 OWNER | PARTNER */
    @Column({ type: 'varchar', default: 'OWNER' }) role: string;

    /** 认领状态 PENDING | ACTIVE | REVOKED */
    @Column({ type: 'varchar', default: 'PENDING' }) status: string;

    /** 发起认领的后台用户 id */
    @Column({ type: 'int', nullable: true }) claimedByUserId: number | null;

    @Column({ type: Date, nullable: true }) claimedAt: Date | null;

    @Column({ type: Date, nullable: true }) verifiedAt: Date | null;

    @Column({ type: 'varchar', nullable: true }) contractNo: string | null;

    @Column({ type: 'text', nullable: true }) note: string | null;
}
