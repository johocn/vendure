import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_audit_log' })
@Index(['entityType', 'entityId'])
export class TcmAuditLog extends VendureEntity {
    constructor(input?: DeepPartial<TcmAuditLog>) {
        super(input);
    }
    @Column({ type: 'varchar', length: 64 })
    entityType: string;
    @Column({ type: 'int' })
    entityId: number;
    @Column({ type: 'int' })
    staffId: number;
    /** CREATE | UPDATE | ARCHIVE */
    @Column({ type: 'varchar', length: 16 })
    action: string;
    /** 字段级 diff（仅字段名与版本，不落明文） */
    @Column({ type: 'simple-json', nullable: true })
    diff?: Record<string, any>;
}
