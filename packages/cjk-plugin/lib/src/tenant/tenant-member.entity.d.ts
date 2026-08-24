import { Administrator, Channel, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 租户内部人员关联表：承载「后台人员 × 所属租户」的归属、启停与备注。
 * 后台人员本体仍是 Vendure 原生 Administrator，本表不改原生实体。
 */
export declare class TenantMember extends VendureEntity {
    constructor(input?: DeepPartial<TenantMember>);
    administrator?: Administrator;
    administratorId: string;
    channel?: Channel;
    channelId: string;
    enabled: boolean;
    /** 首登强改密：为 true 时该人员在更改密码前只能执行基础/改密操作 */
    mustChangePassword: boolean;
    displayName: string | null;
    remark: string | null;
}
