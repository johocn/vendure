import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class CampusBuilding extends VendureEntity {
    [key: string]: any;
    name: string;
    detail: string;
    /** 楼栋坐标（gcj02，与骑手上报坐标系一致）；历史数据可空，跟踪页降级只显示骑手 */
    lat: number;
    lng: number;
    zoneId: ID;
    channelId: ID;
    constructor(input?: DeepPartial<CampusBuilding>);
}
