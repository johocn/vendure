import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { EmployeeCustomer } from './enterprise-customer.entity';
import { PickupLocationService } from '../pickup-location.service';
export declare class EmployeeCustomerService {
    private connection;
    private pickupLocationService;
    constructor(connection: TransactionalConnection, pickupLocationService: PickupLocationService);
    findAll(ctx: RequestContext): Promise<EmployeeCustomer[]>;
    findByCustomer(ctx: RequestContext, customerId: ID): Promise<EmployeeCustomer[]>;
    findOne(ctx: RequestContext, id: ID): Promise<EmployeeCustomer | undefined>;
    create(ctx: RequestContext, input: {
        customerId: ID;
        enterpriseName: string;
        employeeId?: string;
        pickupLocationIds: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer>;
    update(ctx: RequestContext, input: {
        id: ID;
        enterpriseName?: string;
        employeeId?: string;
        pickupLocationIds?: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
    verify(ctx: RequestContext, id: ID): Promise<EmployeeCustomer>;
}
