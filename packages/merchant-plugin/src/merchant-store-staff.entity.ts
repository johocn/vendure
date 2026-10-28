﻿import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 门店员工：门店 × 后台用户（Administrator）的岗位关系。
 * 用户本体仍是 Vendure 原生 Administrator，本表只承载门店域的角色与状态。
 */
@Entity()
@Index(['storeId'])
@Index(['storeId', 'userId'], { unique: true })
export class MerchantStoreStaff extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStoreStaff>) {
        super(input);
    }

    @Column({ type: 'int' }) storeId: number;

    @Column({ type: 'int' }) userId: number;

    @Column({ type: 'varchar', nullable: true }) name: string | null;

    @Column({ type: 'varchar', nullable: true }) phone: string | null;

    /** 门店角色 CLERK | MANAGER | OWNER */
    @Column({ type: 'varchar', default: 'CLERK' }) role: string;

    /** 状态 ACTIVE | DISABLED */
    @Column({ type: 'varchar', default: 'ACTIVE' }) status: string;

    @Column({ type: Date, nullable: true }) lastLoginAt: Date | null;
}
