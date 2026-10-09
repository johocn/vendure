import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmAuditLog extends VendureEntity {
    constructor(input?: DeepPartial<TcmAuditLog>);
    entityType: string;
    entityId: number;
    staffId: number;
    /** CREATE | UPDATE | ARCHIVE */
    action: string;
    /** 字段级 diff（仅字段名与版本，不落明文） */
    diff?: Record<string, any>;
}
