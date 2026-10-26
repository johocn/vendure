import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 门店员工：门店 × 后台用户（Administrator）的岗位关系。
 * 用户本体仍是 Vendure 原生 Administrator，本表只承载门店域的角色与状态。
 */
export declare class MerchantStoreStaff extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStoreStaff>);
    storeId: number;
    userId: number;
    name: string | null;
    phone: string | null;
    /** 门店角色 CLERK | MANAGER | OWNER */
    role: string;
    /** 状态 ACTIVE | DISABLED */
    status: string;
    lastLoginAt: Date | null;
}
