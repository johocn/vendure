import { RequestContext } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';
import { PickupLocation } from './pickup-location.entity';
export declare class PickupLocationShopResolver {
    private pickupLocationService;
    private employeeCustomerService;
    constructor(pickupLocationService: PickupLocationService, employeeCustomerService: EmployeeCustomerService);
    pickupLocations(ctx: RequestContext, type?: string, lat?: number, lng?: number): Promise<PickupLocation[]>;
    employeePickupLocations(ctx: RequestContext, lat?: number, lng?: number): Promise<PickupLocation[]>;
}
