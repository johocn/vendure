import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, ID, PaginatedList, ListQueryOptions, ChannelService } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';

@Injectable()
export class PickupLocationService {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
    ) {}

    async findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>> {
        const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
        const channel = ctx.channel;

        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: channel.id });

        if (options?.filter?.name) {
            qb.andWhere('pl.name LIKE :name', { name: `%${options.filter.name}%` });
        }
        if (options?.filter?.type) {
            qb.andWhere('pl.type = :type', { type: options.filter.type });
        }

        const skip = options?.skip || 0;
        const take = options?.take || 10;
        qb.skip(skip).take(take);

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOne(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined> {
        const result = await this.connection.getRepository(ctx, PickupLocation).findOne({
            where: { id: id as any },
            relations: { channels: true },
        });
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: any): Promise<PickupLocation> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const location = new PickupLocation(input);
        location.channels = [ctx.channel];
        return repo.save(location);
    }

    async update(ctx: RequestContext, input: any): Promise<PickupLocation> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const location = await repo.findOne({ where: { id: input.id } });
        if (!location) {
            throw new Error(`PickupLocation with id ${input.id} not found`);
        }
        Object.assign(location, input);
        return repo.save(location);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        await repo.delete(id);
    }
}
