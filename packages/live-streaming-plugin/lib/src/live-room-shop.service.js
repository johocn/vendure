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
exports.LiveRoomShopService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const core_1 = require("@vendure/core");
const live_room_entity_1 = require("./live-room.entity");
let LiveRoomShopService = class LiveRoomShopService {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    opts = {};
    setOptions(opts) { this.opts = opts; }
    async list(ctx, status) {
        const repo = this.connection.getRepository(ctx, live_room_entity_1.LiveRoom);
        const qb = repo
            .createQueryBuilder('room')
            .leftJoinAndSelect('room.channels', 'channel')
            .leftJoinAndSelect('room.products', 'products')
            .where('channel.id = :channelId', { channelId: ctx.channelId });
        if (status === 'live')
            qb.andWhere('room.status = :s', { s: 'live' });
        else if (status === 'upcoming')
            qb.andWhere('room.status = :s', { s: 'scheduled' });
        else if (status === 'replay')
            qb.andWhere('room.status = :s', { s: 'ended' });
        qb.orderBy('room.scheduledStartAt', 'DESC');
        return qb.getMany();
    }
    async detail(ctx, id) {
        const room = await this.connection
            .findOneInChannel(ctx, live_room_entity_1.LiveRoom, id, ctx.channelId, { relations: ['products'] })
            .then(r => r ?? undefined);
        if (!room)
            throw new core_1.UserInputError('Live room not found');
        room.viewCount += 1;
        await this.connection.getRepository(ctx, live_room_entity_1.LiveRoom).save(room);
        return room;
    }
    enterForRoom(room, customerId, wsUrl, wsSecret) {
        const payload = `${room.id}.${customerId ?? 'guest'}.${Date.now()}`;
        const ticket = wsSecret
            ? (0, crypto_1.createHmac)('sha256', wsSecret).update(payload).digest('hex') + ':' + payload
            : payload;
        return {
            roomId: String(room.id),
            playUrl: room.status === 'live' ? room.playUrl : null,
            pushUrl: room.status === 'live' ? `${this.opts.pushDomain ?? ''}${room.streamKey}` : null,
            wsUrl: wsUrl ?? 'ws://localhost:3003',
            wsTicket: ticket,
        };
    }
    async listProducts(ctx, id) {
        const room = await this.detail(ctx, id);
        return room.products ?? [];
    }
};
exports.LiveRoomShopService = LiveRoomShopService;
exports.LiveRoomShopService = LiveRoomShopService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], LiveRoomShopService);
