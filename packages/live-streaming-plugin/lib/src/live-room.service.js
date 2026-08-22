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
exports.LiveRoomService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const live_room_entity_1 = require("./live-room.entity");
const live_room_product_entity_1 = require("./live-room-product.entity");
function randomKey(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++)
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
}
let LiveRoomService = class LiveRoomService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.opts = {};
    }
    setOptions(opts) { this.opts = opts; }
    findAll(ctx, options) {
        return this.listQueryBuilder
            .build(live_room_entity_1.LiveRoom, options, { ctx, channelId: ctx.channelId, relations: ['products'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOne(ctx, id) {
        return this.connection
            .findOneInChannel(ctx, live_room_entity_1.LiveRoom, id, ctx.channelId, { relations: ['products'] })
            .then(r => r ?? undefined);
    }
    async create(ctx, input) {
        const room = new live_room_entity_1.LiveRoom({
            name: input.name,
            coverUrl: input.coverUrl ?? null,
            description: input.description ?? null,
            streamerCustomerId: input.streamerCustomerId ?? null,
            streamerName: input.streamerName ?? null,
            type: input.type ?? 'product',
            status: 'scheduled',
            scheduledStartAt: input.scheduledStartAt ? new Date(input.scheduledStartAt) : null,
            streamKey: null,
            playUrl: null,
            replayUrl: null,
            likeCount: 0,
            viewCount: 0,
        });
        room.channels = [await this.connection.getEntityOrThrow(ctx, core_1.Channel, ctx.channelId)];
        return this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).save(room);
    }
    async update(ctx, input) {
        const room = await this.findOne(ctx, input.id);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        if (input.name != null)
            room.name = input.name;
        if (input.coverUrl !== undefined)
            room.coverUrl = input.coverUrl;
        if (input.description !== undefined)
            room.description = input.description;
        if (input.streamerCustomerId !== undefined)
            room.streamerCustomerId = input.streamerCustomerId;
        if (input.streamerName !== undefined)
            room.streamerName = input.streamerName;
        if (input.type !== undefined)
            room.type = input.type;
        if (input.scheduledStartAt !== undefined)
            room.scheduledStartAt = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
        return this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).save(room);
    }
    async delete(ctx, id) {
        const room = await this.findOne(ctx, id);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        const productIds = room.products.map(p => p.id);
        if (productIds.length) {
            await this.connection.getRepository(ctx, live_room_product_entity_1.LiveRoomProduct)
                .createQueryBuilder('p')
                .delete()
                .where('id IN (:...ids)', { ids: productIds })
                .execute();
        }
        await this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).remove(room);
        return true;
    }
    async start(ctx, id) {
        const room = await this.findOne(ctx, id);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        if (!room.streamKey) {
            room.streamKey = randomKey(this.opts.streamKeyLength ?? 16);
        }
        room.playUrl = `${this.opts.playDomain ?? ''}${room.streamKey}.m3u8`;
        room.status = 'live';
        room.startedAt = new Date();
        return this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).save(room);
    }
    async stop(ctx, id, replayUrl) {
        const room = await this.findOne(ctx, id);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        room.status = 'ended';
        room.endedAt = new Date();
        if (replayUrl)
            room.replayUrl = replayUrl;
        return this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).save(room);
    }
    pushUrlOf(room) {
        if (!room.streamKey)
            return null;
        return `${this.opts.pushDomain ?? ''}${room.streamKey}`;
    }
    async addProduct(ctx, roomId, input) {
        const room = await this.findOne(ctx, roomId);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        const product = new live_room_product_entity_1.LiveRoomProduct({
            variantId: String(input.variantId),
            name: input.name,
            price: input.price,
            imageUrl: input.imageUrl ?? null,
            sortOrder: input.sortOrder ?? 0,
        });
        product.channels = [await this.connection.getEntityOrThrow(ctx, core_1.Channel, ctx.channelId)];
        const saved = await this.connection.getRepository(ctx, live_room_product_entity_1.LiveRoomProduct).save(product);
        const repo = this.connection.getRepository(ctx, live_room_entity_1.LiveRoom);
        const current = await repo.findOne({ where: { id: roomId }, relations: ['products'] });
        current.products = [...(current.products ?? []), saved];
        return repo.save(current);
    }
    async removeProduct(ctx, roomId, productId) {
        const repo = this.connection.getRepository(ctx, live_room_entity_1.LiveRoom);
        const current = await repo.findOne({ where: { id: roomId }, relations: ['products'] });
        if (!current)
            throw new core_1.UserInputError('Live room not found');
        current.products = (current.products ?? []).filter(p => String(p.id) !== String(productId));
        await this.connection.getRepository(ctx, live_room_product_entity_1.LiveRoomProduct).delete(productId).catch(() => undefined);
        return repo.save(current);
    }
};
exports.LiveRoomService = LiveRoomService;
exports.LiveRoomService = LiveRoomService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], LiveRoomService);
