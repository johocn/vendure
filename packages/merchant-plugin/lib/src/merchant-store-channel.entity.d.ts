import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 门店认领关系：租户渠道 × 门店的可选绑定。
 *
 * 与租户 Channel 解耦的边界就在这里——门店本身不挂渠道，渠道通过本表认领门店；
 * 撤销认领只改状态（REVOKED），不物理删除，便于审计与重新认领。
 */
export declare class MerchantStoreChannel extends VendureEntity {
    constructor(input?: DeepPartial<MerchantStoreChannel>);
    storeId: number;
    channelId: number;
    /** 关系角色 OWNER | PARTNER */
    role: string;
    /** 认领状态 PENDING | ACTIVE | REVOKED */
    status: string;
    /** 发起认领的后台用户 id */
    claimedByUserId: number | null;
    claimedAt: Date | null;
    verifiedAt: Date | null;
    contractNo: string | null;
    note: string | null;
}
