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
exports.LiveCommissionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const distribution_plugin_1 = require("@vendure/distribution-plugin");
const live_room_entity_1 = require("./live-room.entity");
const constants_1 = require("./constants");
let LiveCommissionService = class LiveCommissionService {
    connection;
    eventBus;
    initialized = false;
    opts = {};
    constructor(connection, eventBus) {
        this.connection = connection;
        this.eventBus = eventBus;
    }
    setOptions(opts) { this.opts = opts; }
    init() {
        if (this.initialized)
            return;
        this.initialized = true;
        this.eventBus.ofType(core_1.PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Settled')
                return;
            try {
                await this.calculateLiveCommission(event);
            }
            catch (e) {
                core_1.Logger.error(`Failed live commission for order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
            }
        });
    }
    async setOrderLiveRoom(ctx, orderId, roomId) {
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const order = await repo.findOne({ where: { id: orderId } });
        if (!order)
            throw new Error('Order not found');
        order.customFields = { ...order.customFields, liveRoomId: Number(roomId) };
        await repo.save(order);
    }
    async calculateLiveCommission(event) {
        const ctx = event.ctx;
        const order = event.order;
        const roomId = order.customFields?.liveRoomId;
        if (!roomId)
            return;
        const roomRepo = this.connection.getRepository(ctx, live_room_entity_1.LiveRoom);
        const room = await roomRepo.findOne({ where: { id: String(roomId) } });
        if (!room?.streamerCustomerId)
            return;
        const distRepo = this.connection.getRepository(ctx, distribution_plugin_1.Distributor);
        const distributor = await distRepo
            .createQueryBuilder('d')
            .leftJoinAndSelect('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: room.streamerCustomerId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        if (!distributor || distributor.status !== 'active')
            return;
        if (String(distributor.customerId) === String(order.customer?.id))
            return;
        const rate = this.opts.liveCommissionRate ?? 1000;
        const amount = Math.floor(order.total * rate / 10000);
        if (amount <= 0)
            return;
        await this.connection.startTransaction(ctx);
        try {
            const channel = await this.connection.getEntityOrThrow(ctx, core_1.Channel, ctx.channelId);
            const record = new distribution_plugin_1.CommissionRecord({
                distributorId: String(distributor.id),
                orderId: String(order.id),
                commissionType: 'direct',
                commissionRate: rate,
                orderAmount: order.total,
                commissionAmount: amount,
                status: 'pending',
                settledAt: null,
            });
            record.channels = [channel];
            await this.connection.getRepository(ctx, distribution_plugin_1.CommissionRecord).save(record);
            core_1.Logger.info(`Live commission ${amount} for streamer ${room.streamerCustomerId}`, constants_1.loggerCtx);
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
};
exports.LiveCommissionService = LiveCommissionService;
exports.LiveCommissionService = LiveCommissionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.EventBus])
], LiveCommissionService);
