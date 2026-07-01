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
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("./pickup-location.entity");
let PickupLocationService = class PickupLocationService {
    constructor(connection, channelService) {
        this.connection = connection;
        this.channelService = channelService;
    }
    async findAll(ctx, options) {
        var _a, _b;
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        const channel = ctx.channel;
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: channel.id });
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
    async create(ctx, input) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = new pickup_location_entity_1.PickupLocation(input);
        location.channels = [ctx.channel];
        return repo.save(location);
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = await repo.findOne({ where: { id: input.id } });
        if (!location) {
            throw new Error(`PickupLocation with id ${input.id} not found`);
        }
        Object.assign(location, input);
        return repo.save(location);
    }
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        await repo.delete(id);
    }
};
exports.PickupLocationService = PickupLocationService;
exports.PickupLocationService = PickupLocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ChannelService])
], PickupLocationService);
//# sourceMappingURL=pickup-location.service.js.map