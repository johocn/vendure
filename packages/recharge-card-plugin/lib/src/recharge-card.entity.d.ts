import { Channel, ChannelAware, Customer, DeepPartial, VendureEntity } from '@vendure/core';
import { RechargeCardState } from './types';
export declare class RechargeCard extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<RechargeCard>);
    code: string;
    pinHash: string;
    faceValue: number;
    state: RechargeCardState;
    batchId: number;
    redeemedBy: Customer | null;
    redeemedByCustomerId: number | null;
    redeemedAt: Date | null;
    expiresAt: Date | null;
    channels: Channel[];
}
