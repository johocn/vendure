import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 骑手位置历史轨迹（P8-4）：实时位置仍写 Order.customFields.riderLat/riderLng 供 C 端跟踪，
 * 本表只做留痕（配送中每 10s 一条，30 天后由调度任务清理）。 */
export declare class CampusRiderLocation extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    orderId: ID;
    riderCustomerId: ID;
    lat: number;
    lng: number;
    reportedAt: Date;
    constructor(input?: DeepPartial<CampusRiderLocation>);
}
