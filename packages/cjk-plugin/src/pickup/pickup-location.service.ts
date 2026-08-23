import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
    Channel,
    EntityNotFoundError,
    ID,
    PaginatedList,
    ListQueryOptions,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';

@Injectable()
export class PickupLocationService {
    constructor(private connection: TransactionalConnection) {}

    async findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>> {
        const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
        // 可见规则：公共点 + 本租户自建点
        qb.where(
            '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
            { isPublic: true, channelId: ctx.channelId }
        );
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });

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

    async findByType(ctx: RequestContext, type: string): Promise<PickupLocation[]> {
        const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
        qb.where(
            '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
            { isPublic: true, channelId: ctx.channelId }
        );
        qb.andWhere('pl.type = :type', { type });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        return qb.getMany();
    }

    /**
     * 按城市动态聚合当前渠道可见的启用自提点（rangeMode='all' 用）。
     * 语义：可见规则(公共点+本租户自建点) + 类型匹配 + enabled=true + 同 city + channels 关联当前渠道。
     * city 可为空 → 聚合当前渠道全部可见且启用的同类型自提点。
     */
    async findByCityForChannel(ctx: RequestContext, city: string | null, type: string): Promise<PickupLocation[]> {
        const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
        qb.where(
            '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
            { isPublic: true, channelId: ctx.channelId }
        );
        qb.andWhere('pl.type = :type', { type });
        qb.andWhere('pl.enabled = :enabled', { enabled: true });
        if (city) {
            qb.andWhere('pl.city = :city', { city });
        }
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        return qb.getMany();
    }

    async findByIds(ctx: RequestContext, ids: ID[]): Promise<PickupLocation[]> {
        if (ids.length === 0) return [];
        const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
        qb.where(
            '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
            { isPublic: true, channelId: ctx.channelId }
        );
        qb.andWhere('pl.id IN (:...ids)', { ids });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        return qb.getMany();
    }

    async create(ctx: RequestContext, input: any): Promise<PickupLocation> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const location = new PickupLocation(input);
        location.channels = [ctx.channel];
        location.ownerChannelId = ctx.channelId;
        location.isPublic = input.isPublic ?? false;
        return repo.save(location);
    }

    async update(ctx: RequestContext, input: any): Promise<PickupLocation> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const location = await repo.findOne({ where: { id: input.id } });
        if (!location) {
            throw new EntityNotFoundError('PickupLocation', input.id);
        }
        Object.assign(location, input);
        return repo.save(location);
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        await repo.delete(id);
    }

    async promoteToPublic(ctx: RequestContext, id: ID): Promise<PickupLocation> {
        const loc = await this.findOne(ctx, id);
        if (!loc) throw new EntityNotFoundError('PickupLocation', id);
        loc.isPublic = true;
        loc.ownerChannelId = null;
        return this.connection.getRepository(ctx, PickupLocation).save(loc);
    }

    async assignToChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const locations = await repo.find({
            where: { id: In(ids as any[]) },
            relations: { channels: true },
        });
        const channel = await this.connection.getRepository(ctx, Channel).findOne({
            where: { id: channelId as any },
        });
        if (!channel) throw new EntityNotFoundError('Channel', channelId);

        for (const loc of locations) {
            if (!loc.channels.find(c => c.id === channelId)) {
                loc.channels.push(channel);
            }
        }
        await repo.save(locations);
    }

    async removeFromChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PickupLocation);
        const locations = await repo.find({
            where: { id: In(ids as any[]) },
            relations: { channels: true },
        });
        for (const loc of locations) {
            loc.channels = loc.channels.filter(c => c.id !== channelId);
        }
        await repo.save(locations);
    }

    async sortByDistance(locations: PickupLocation[], lat: number, lng: number): Promise<PickupLocation[]> {
        return locations
            .map(loc => ({
                loc,
                distance: loc.coordinates
                    ? this.haversineDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng)
                    : Number.MAX_VALUE
            }))
            .sort((a, b) => a.distance - b.distance)
            .map(item => item.loc);
    }

    private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
