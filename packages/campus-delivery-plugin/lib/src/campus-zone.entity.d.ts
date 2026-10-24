import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class CampusZone extends VendureEntity {
    [key: string]: any;
    name: string;
    fee: number;
    channelId: ID;
    constructor(input?: DeepPartial<CampusZone>);
}
