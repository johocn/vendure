import { Channel, ChannelAware, DeepPartial, HasCustomFields, ID, VendureEntity } from '@vendure/core';
declare class CustomShippingTemplateFields {
}
/**
 * 配送方案模板
 *
 * 分为两类：
 * - 全局模板（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户模板（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从模板创建配送方式后，生成的 ShippingMethod 实例与模板完全解耦。
 */
export declare class ShippingTemplate extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<ShippingTemplate>);
    name: string;
    description: string;
    code: string;
    fulfillmentHandler: string;
    checker: {
        code: string;
        arguments: Array<{
            name: string;
            value: string;
        }>;
    };
    calculator: {
        code: string;
        arguments: Array<{
            name: string;
            value: string;
        }>;
    };
    isGlobal: boolean;
    ownerChannelId: ID | null;
    channels: Channel[];
    customFields: CustomShippingTemplateFields;
}
export {};
