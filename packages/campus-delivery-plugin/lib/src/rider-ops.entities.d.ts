import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 骑手排班：按日期 + 时段登记，后台视图展示「排班 vs 实际在线」。 */
export declare class CampusRiderShift extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    riderCustomerId: ID;
    /** YYYY-MM-DD（校园时区） */
    shiftDate: string;
    /** HH:mm */
    startTime: string;
    endTime: string;
    note: string | null;
    constructor(input?: DeepPartial<CampusRiderShift>);
}
/** 骑手在线会话：上线开、下线/心跳超时关，用于统计实际在线时长。 */
export declare class CampusRiderSession extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    riderCustomerId: ID;
    startedAt: Date;
    endedAt: Date | null;
    /** 最近心跳：超时（5min）由运力预警 job 关会话 */
    lastHeartbeatAt: Date | null;
    /** 分钟数（关会话时落库，便于按日聚合；null=进行中） */
    minutes: number | null;
    constructor(input?: DeepPartial<CampusRiderSession>);
}
/** 用户给骑手评分（1-5 + 标签，一单一条幂等）。 */
export declare class CampusRiderReview extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    riderCustomerId: ID;
    orderId: number;
    rating: number;
    tags: string[] | null;
    comment: string | null;
    constructor(input?: DeepPartial<CampusRiderReview>);
}
