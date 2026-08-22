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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveShopResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const live_room_service_1 = require("./live-room.service");
const live_room_shop_service_1 = require("./live-room-shop.service");
const live_commission_service_1 = require("./live-commission.service");
const constants_1 = require("./constants");
let LiveShopResolver = class LiveShopResolver {
    constructor(options, liveRoomService, liveRoomShopService, liveCommissionService, orderService) {
        this.options = options;
        this.liveRoomService = liveRoomService;
        this.liveRoomShopService = liveRoomShopService;
        this.liveCommissionService = liveCommissionService;
        this.orderService = orderService;
    }
    async liveRooms(ctx, status) {
        return this.liveRoomShopService.list(ctx, status);
    }
    async liveRoom(ctx, id) {
        return this.liveRoomShopService.detail(ctx, id);
    }
    async liveRoomProducts(ctx, id) {
        return this.liveRoomShopService.listProducts(ctx, id);
    }
    async enterLiveRoom(ctx, roomId) {
        const room = await this.liveRoomService.findOne(ctx, roomId);
        if (!room)
            throw new Error('Live room not found');
        return this.liveRoomShopService.enterForRoom(room, ctx.activeUserId, this.options.wsUrl, this.options.wsSecret);
    }
    async setOrderLiveRoom(ctx, roomId) {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
        if (!order)
            throw new Error('No active order');
        await this.liveCommissionService.setOrderLiveRoom(ctx, String(order.id), String(roomId));
        return this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId);
    }
};
exports.LiveShopResolver = LiveShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], LiveShopResolver.prototype, "liveRooms", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveShopResolver.prototype, "liveRoom", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveShopResolver.prototype, "liveRoomProducts", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveShopResolver.prototype, "enterLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveShopResolver.prototype, "setOrderLiveRoom", null);
exports.LiveShopResolver = LiveShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, common_1.Inject)(constants_1.LIVE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, live_room_service_1.LiveRoomService,
        live_room_shop_service_1.LiveRoomShopService,
        live_commission_service_1.LiveCommissionService,
        core_1.OrderService])
], LiveShopResolver);
