import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { EmployeeCustomer } from './enterprise-customer.entity';
import { PickupLocationService } from '../pickup-location.service';

@Injectable()
export class EmployeeCustomerService {
    constructor(
        private connection: TransactionalConnection,
        private pickupLocationService: PickupLocationService,
    ) {}

    async findAll(ctx: RequestContext): Promise<EmployeeCustomer[]> {
        return this.connection.getRepository(ctx, EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .leftJoinAndSelect('ec.customer', 'customer')
            .where('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getMany();
    }

    async findByCustomer(ctx: RequestContext, customerId: ID): Promise<EmployeeCustomer[]> {
        return this.connection.getRepository(ctx, EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.customerId = :customerId', { customerId })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<EmployeeCustomer | undefined> {
        const result = await this.connection.getRepository(ctx, EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.id = :id', { id })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: {
        customerId: ID;
        enterpriseName: string;
        employeeId?: string;
        pickupLocationIds: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer> {
        const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
        const allowedIds = allowedLocations.map(l => l.id);
        const invalidIds = input.pickupLocationIds.filter(id => !allowedIds.includes(id));
        if (invalidIds.length > 0) {
            throw new UserInputError('部分自提点不在当前租户可见范围内');
        }

        const ec = new EmployeeCustomer();
        ec.customerId = input.customerId;
        ec.enterpriseName = input.enterpriseName;
        ec.employeeId = input.employeeId as string;
        ec.channelId = ctx.channelId;
        ec.verified = input.verified ?? false;
        ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds.includes(l.id));

        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        enterpriseName?: string;
        employeeId?: string;
        pickupLocationIds?: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer> {
        const ec = await this.findOne(ctx, input.id);
        if (!ec) throw new UserInputError('EmployeeCustomer not found');

        if (input.enterpriseName != null) ec.enterpriseName = input.enterpriseName;
        if (input.employeeId != null) ec.employeeId = input.employeeId;
        if (input.verified != null) ec.verified = input.verified;

        if (input.pickupLocationIds != null) {
            const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
            ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds!.includes(l.id));
        }

        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const ec = await this.findOne(ctx, id);
        if (!ec) return false;
        await this.connection.getRepository(ctx, EmployeeCustomer).remove(ec);
        return true;
    }

    async verify(ctx: RequestContext, id: ID): Promise<EmployeeCustomer> {
        const ec = await this.findOne(ctx, id);
        if (!ec) throw new UserInputError('EmployeeCustomer not found');
        ec.verified = true;
        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }
}
