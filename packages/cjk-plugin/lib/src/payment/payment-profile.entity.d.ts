import { Channel, ChannelAware, DeepPartial, ID, PaymentMethod, VendureEntity } from '@vendure/core';
/**
 * 支付方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建支付方式后，生成的 PaymentMethod 实例与档案完全解耦。
 */
export declare class PaymentProfile extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PaymentProfile>);
    name: string;
    description: string;
    code: string;
    isGlobal: boolean;
    ownerChannelId: ID | null;
    installmentOptions: Record<string, any> | null;
    paymentMethods: PaymentMethod[];
    channels: Channel[];
}
