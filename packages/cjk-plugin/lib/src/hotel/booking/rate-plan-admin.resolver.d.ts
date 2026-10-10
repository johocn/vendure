import { ID, RequestContext } from '@vendure/core';
import { HotelRatePlan } from './rate-plan.entity';
import { HotelRatePlanService } from './rate-plan.service';
export declare class HotelRatePlanAdminResolver {
    private ratePlanService;
    constructor(ratePlanService: HotelRatePlanService);
    hotelRatePlans(ctx: RequestContext, variantId: ID): Promise<HotelRatePlan[]>;
    createHotelRatePlan(ctx: RequestContext, variantId: ID, input: any): Promise<HotelRatePlan>;
    updateHotelRatePlan(ctx: RequestContext, id: ID, input: any): Promise<HotelRatePlan>;
    deleteHotelRatePlan(ctx: RequestContext, id: ID): Promise<boolean>;
}
