import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class RechargeCardBatch extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<RechargeCardBatch>);
    name: string;
    prefix: string;
    faceValue: number;
    quantity: number;
    generatedCount: number;
    expiresAt?: Date;
    channels: Channel[];
    plaintextPins?: {
        code: string;
        pin: string;
    }[];
}
