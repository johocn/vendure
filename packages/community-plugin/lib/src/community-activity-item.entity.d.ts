import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class CommunityActivityItem extends VendureEntity {
    constructor(input?: DeepPartial<CommunityActivityItem>);
    activityId: number;
    variantId: number;
    price: number;
    stockLimit?: number | null;
}
