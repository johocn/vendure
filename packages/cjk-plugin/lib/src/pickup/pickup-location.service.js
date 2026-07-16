"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupLocationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("./pickup-location.entity");
let PickupLocationService = class PickupLocationService {
    constructor(connection) {
        this.connection = connection;
    }
    async findAll(ctx, options) {
        var _a, _b;
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        // 可见规则：公共点 + 本租户自建点
        qb.where('(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)', { isPublic: true, channelId: ctx.channelId });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        if ((_a = options === null || options === void 0 ? void 0 : options.filter) === null || _a === void 0 ? void 0 : _a.name) {
            qb.andWhere('pl.name LIKE :name', { name: `%${options.filter.name}%` });
        }
        if ((_b = options === null || options === void 0 ? void 0 : options.filter) === null || _b === void 0 ? void 0 : _b.type) {
            qb.andWhere('pl.type = :type', { type: options.filter.type });
        }
        const skip = (options === null || options === void 0 ? void 0 : options.skip) || 0;
        const take = (options === null || options === void 0 ? void 0 : options.take) || 10;
        qb.skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOne(ctx, id) {
        const result = await this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).findOne({
            where: { id: id },
            relations: { channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findByType(ctx, type) {
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        qb.where('(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)', { isPublic: true, channelId: ctx.channelId });
        qb.andWhere('pl.type = :type', { type });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        return qb.getMany();
    }
    async findByIds(ctx, ids) {
        if (ids.length === 0)
            return [];
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        qb.where('(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)', { isPublic: true, channelId: ctx.channelId });
        qb.andWhere('pl.id IN (:...ids)', { ids });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        return qb.getMany();
    }
    async create(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = new pickup_location_entity_1.PickupLocation(input);
        location.channels = [ctx.channel];
        location.ownerChannelId = ctx.channelId;
        location.isPublic = (_a = input.isPublic) !== null && _a !== void 0 ? _a : false;
        return repo.save(location);
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = await repo.findOne({ where: { id: input.id } });
        if (!location) {
            throw new core_1.EntityNotFoundError('PickupLocation', input.id);
        }
        Object.assign(location, input);
        return repo.save(location);
    }
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        await repo.delete(id);
    }
    async promoteToPublic(ctx, id) {
        const loc = await this.findOne(ctx, id);
        if (!loc)
            throw new core_1.EntityNotFoundError('PickupLocation', id);
        loc.isPublic = true;
        loc.ownerChannelId = null;
        return this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).save(loc);
    }
    async assignToChannel(ctx, ids, channelId) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const locations = await repo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: { channels: true },
        });
        const channel = await this.connection.getRepository(ctx, core_1.Channel).findOne({
            where: { id: channelId },
        });
        if (!channel)
            throw new core_1.EntityNotFoundError('Channel', channelId);
        for (const loc of locations) {
            if (!loc.channels.find(c => c.id === channelId)) {
                loc.channels.push(channel);
            }
        }
        await repo.save(locations);
    }
    async removeFromChannel(ctx, ids, channelId) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const locations = await repo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: { channels: true },
        });
        for (const loc of locations) {
            loc.channels = loc.channels.filter(c => c.id !== channelId);
        }
        await repo.save(locations);
    }
    async sortByDistance(locations, lat, lng) {
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
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
exports.PickupLocationService = PickupLocationService;
exports.PickupLocationService = PickupLocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], PickupLocationService);
//# sourceMappingURL=pickup-location.service.js.map