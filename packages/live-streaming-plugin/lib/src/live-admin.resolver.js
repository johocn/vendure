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
exports.LiveAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const live_room_service_1 = require("./live-room.service");
let LiveAdminResolver = class LiveAdminResolver {
    liveRoomService;
    constructor(liveRoomService) {
        this.liveRoomService = liveRoomService;
    }
    async liveRooms(ctx, options) {
        return this.liveRoomService.findAll(ctx, options);
    }
    async liveRoom(ctx, id) {
        return this.liveRoomService.findOne(ctx, id);
    }
    async createLiveRoom(ctx, input) {
        return this.liveRoomService.create(ctx, input);
    }
    async updateLiveRoom(ctx, input) {
        return this.liveRoomService.update(ctx, input);
    }
    async deleteLiveRoom(ctx, id) {
        return this.liveRoomService.delete(ctx, id);
    }
    async startLiveRoom(ctx, id) {
        return this.liveRoomService.start(ctx, id);
    }
    async stopLiveRoom(ctx, id, replayUrl) {
        return this.liveRoomService.stop(ctx, id, replayUrl);
    }
    async addLiveRoomProduct(ctx, roomId, input) {
        return this.liveRoomService.addProduct(ctx, roomId, input);
    }
    async removeLiveRoomProduct(ctx, roomId, productId) {
        return this.liveRoomService.removeProduct(ctx, roomId, productId);
    }
};
exports.LiveAdminResolver = LiveAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "liveRooms", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "liveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "createLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "updateLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "deleteLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "startLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('replayUrl')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "stopLiveRoom", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roomId')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "addLiveRoomProduct", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('roomId')),
    __param(2, (0, graphql_1.Args)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], LiveAdminResolver.prototype, "removeLiveRoomProduct", null);
exports.LiveAdminResolver = LiveAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [live_room_service_1.LiveRoomService])
], LiveAdminResolver);
