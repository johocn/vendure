import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';
import { EmployeeCustomerService } from './enterprise-customer.service';
import { EmployeeCustomer } from './enterprise-customer.entity';
import { PickupPermissions } from '../pickup-permissions';

@Resolver()
export class EmployeeCustomerAdminResolver {
    constructor(private employeeCustomerService: EmployeeCustomerService) {}

    @Query()
    @Allow(PickupPermissions.ReadEmployeeCustomer as Permission)
    async employeeCustomers(@Ctx() ctx: RequestContext): Promise<EmployeeCustomer[]> {
        return this.employeeCustomerService.findAll(ctx);
    }

    @Query()
    @Allow(PickupPermissions.ReadEmployeeCustomer as Permission)
    async employeeCustomer(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<EmployeeCustomer | undefined> {
        return this.employeeCustomerService.findOne(ctx, id);
    }

    @Query()
    @Allow(PickupPermissions.ReadEmployeeCustomer as Permission)
    async employeeCustomersByCustomer(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
    ): Promise<EmployeeCustomer[]> {
        return this.employeeCustomerService.findByCustomer(ctx, customerId);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.CreateEmployeeCustomer as Permission)
    async createEmployeeCustomer(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.UpdateEmployeeCustomer as Permission)
    async updateEmployeeCustomer(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.DeleteEmployeeCustomer as Permission)
    async deleteEmployeeCustomer(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<boolean> {
        return this.employeeCustomerService.delete(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.BindPickupLocation as Permission)
    async bindEnterprisePickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('pickupLocationIds') pickupLocationIds: ID[],
    ): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.update(ctx, { id, pickupLocationIds });
    }

    @Mutation()
    @Transaction()
    @Allow(PickupPermissions.VerifyEmployeeCustomer as Permission)
    async verifyEmployeeCustomer(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.verify(ctx, id);
    }
}
