import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 发票抬头（单位抬头资料），C端保存/复用/设默认。
 * 归属：customerId（Vendure 本地 userId），多租户经 channels 隔离。
 */
export declare class InvoiceTitle extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<InvoiceTitle>);
    /** 单位/个人抬头名称 */
    title: string;
    taxNumber: string | null;
    email: string | null;
    companyAddress: string | null;
    companyPhone: string | null;
    bankName: string | null;
    bankAccount: string | null;
    /** 归属用户（C端本地 userId） */
    customerId: number;
    /** 是否为该用户的默认抬头 */
    isDefault: boolean;
    channels: Channel[];
}
