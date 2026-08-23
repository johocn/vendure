import { Channel, ChannelAware, DeepPartial, HasCustomFields, ID, VendureEntity } from '@vendure/core';
declare class CustomPaymentTemplateFields {
}
/**
 * 支付方式模板
 *
 * 分为两类：
 * - 全局模板（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户模板（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从模板创建支付方式后，生成的 PaymentMethod 实例与模板完全解耦。
 */
export declare class PaymentTemplate extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PaymentTemplate>);
    name: string;
    description: string;
    code: string;
    handler: {
        code: string;
        arguments: Array<{
            name: string;
            value: string;
        }>;
    };
    checker: {
        code: string;
        arguments: Array<{
            name: string;
            value: string;
        }>;
    } | null;
    isGlobal: boolean;
    ownerChannelId: ID | null;
    channels: Channel[];
    customFields: CustomPaymentTemplateFields;
}
export {};
