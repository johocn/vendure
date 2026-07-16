import { Channel, Customer, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { PickupLocation } from '../pickup-location.entity';
export declare class EmployeeCustomer extends VendureEntity {
    constructor(input?: DeepPartial<EmployeeCustomer>);
    customer: Customer;
    customerId: ID;
    enterpriseName: string;
    employeeId: string;
    pickupLocations: PickupLocation[];
    channel: Channel;
    channelId: ID;
    verified: boolean;
}
