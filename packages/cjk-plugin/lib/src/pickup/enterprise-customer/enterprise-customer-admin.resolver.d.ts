import { ID, RequestContext } from '@vendure/core';
import { EmployeeCustomerService } from './enterprise-customer.service';
import { EmployeeCustomer } from './enterprise-customer.entity';
export declare class EmployeeCustomerAdminResolver {
    private employeeCustomerService;
    constructor(employeeCustomerService: EmployeeCustomerService);
    employeeCustomers(ctx: RequestContext): Promise<EmployeeCustomer[]>;
    employeeCustomer(ctx: RequestContext, id: ID): Promise<EmployeeCustomer | undefined>;
    employeeCustomersByCustomer(ctx: RequestContext, customerId: ID): Promise<EmployeeCustomer[]>;
    createEmployeeCustomer(ctx: RequestContext, input: any): Promise<EmployeeCustomer>;
    updateEmployeeCustomer(ctx: RequestContext, input: any): Promise<EmployeeCustomer>;
    deleteEmployeeCustomer(ctx: RequestContext, id: ID): Promise<boolean>;
    bindEnterprisePickupLocations(ctx: RequestContext, id: ID, pickupLocationIds: ID[]): Promise<EmployeeCustomer>;
    verifyEmployeeCustomer(ctx: RequestContext, id: ID): Promise<EmployeeCustomer>;
}
