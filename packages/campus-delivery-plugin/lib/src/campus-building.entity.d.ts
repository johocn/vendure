import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class CampusBuilding extends VendureEntity {
    [key: string]: any;
    name: string;
    detail: string;
    zoneId: ID;
    channelId: ID;
    constructor(input?: DeepPartial<CampusBuilding>);
}
