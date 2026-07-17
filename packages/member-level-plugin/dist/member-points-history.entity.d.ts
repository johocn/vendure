import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare enum PointsHistoryType {
    EARN = "earn",
    SPEND = "spend",
    ADJUST = "adjust",
    EXPIRE = "expire"
}
export declare class MemberPointsHistory extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MemberPointsHistory>);
    customerId: number;
    type: PointsHistoryType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    orderId: number | null;
    remark: string | null;
    expiresAt?: Date;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
