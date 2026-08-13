import { Channel, ChannelAware, DeepPartial, ID, ShippingMethod, VendureEntity } from '@vendure/core';
import { PickupLocation } from '../pickup/pickup-location.entity';
/**
 * 配送方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建配送方式后，生成的 ShippingMethod 实例与档案完全解耦。
 */
export declare class ShippingProfile extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<ShippingProfile>);
    name: string;
    description: string;
    code: string;
    isGlobal: boolean;
    ownerChannelId: ID | null;
    freeShippingThreshold: number | null;
    shippingMethods: ShippingMethod[];
    /**
     * 允许的自提点列表（仅当 shippingMethods 含 store-pickup/pickup-point 时生效）
     * 为空表示不约束，所有自提点可选
     */
    pickupLocations: PickupLocation[];
    channels: Channel[];
}
