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
exports.PickBatchAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const tenant_member_entity_1 = require("../tenant/tenant-member.entity");
const pick_batch_service_1 = require("./pick-batch.service");
/** 配货台（拣货批次）admin 接口 */
let PickBatchAdminResolver = class PickBatchAdminResolver {
    constructor(pickBatchService, connection) {
        this.pickBatchService = pickBatchService;
        this.connection = connection;
    }
    async pickBatches(ctx, args) {
        var _a;
        return this.pickBatchService.findAllView(ctx, (_a = args.options) !== null && _a !== void 0 ? _a : {});
    }
    async pickBatch(ctx, id) {
        return this.pickBatchService.detail(ctx, id);
    }
    async pickBatchPickingList(ctx, id) {
        return this.pickBatchService.pickingList(ctx, id);
    }
    async pickBatchCandidates(ctx, args) {
        var _a;
        return this.pickBatchService.candidates(ctx, (_a = args.options) !== null && _a !== void 0 ? _a : {});
    }
    async createPickBatch(ctx, input) {
        var _a, _b;
        const createdBy = await this.currentOperator(ctx);
        const batch = await this.pickBatchService.create(ctx, {
            stockLocationId: Number(input.stockLocationId),
            orderIds: ((_a = input.orderIds) !== null && _a !== void 0 ? _a : []).map(Number),
            note: (_b = input.note) !== null && _b !== void 0 ? _b : null,
        }, createdBy);
        return this.pickBatchService.detail(ctx, batch.id);
    }
    async addOrdersToPickBatch(ctx, batchId, orderIds) {
        await this.pickBatchService.addOrders(ctx, batchId, orderIds.map(Number));
        return this.pickBatchService.detail(ctx, batchId);
    }
    async removeOrdersFromPickBatch(ctx, batchId, orderIds) {
        await this.pickBatchService.removeOrders(ctx, batchId, orderIds.map(Number));
        return this.pickBatchService.detail(ctx, batchId);
    }
    async advancePickBatchState(ctx, batchId, to) {
        await this.pickBatchService.advance(ctx, batchId, to);
        return this.pickBatchService.detail(ctx, batchId);
    }
    async cancelPickBatch(ctx, batchId) {
        await this.pickBatchService.cancel(ctx, batchId);
        return this.pickBatchService.detail(ctx, batchId);
    }
    async shipPickBatch(ctx, args) {
        var _a;
        return this.pickBatchService.ship(ctx, args.batchId, (_a = args.input) !== null && _a !== void 0 ? _a : {});
    }
    /** 操作人：优先 TenantMember.displayName，回退 Administrator 名字 */
    async currentOperator(ctx) {
        const userId = ctx.activeUserId;
        if (!userId)
            return null;
        const member = await this.connection.getRepository(ctx, tenant_member_entity_1.TenantMember).findOne({
            where: { administratorId: String(userId) },
        });
        if (member === null || member === void 0 ? void 0 : member.displayName)
            return member.displayName;
        const admin = await this.connection.getRepository(ctx, core_1.Administrator).findOne({
            where: { id: userId },
        });
        if (!admin)
            return null;
        const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
        return name || null;
    }
};
exports.PickBatchAdminResolver = PickBatchAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "pickBatches", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "pickBatch", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "pickBatchPickingList", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "pickBatchCandidates", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "createPickBatch", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('batchId')),
    __param(2, (0, graphql_1.Args)('orderIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "addOrdersToPickBatch", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('batchId')),
    __param(2, (0, graphql_1.Args)('orderIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "removeOrdersFromPickBatch", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('batchId')),
    __param(2, (0, graphql_1.Args)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "advancePickBatchState", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "cancelPickBatch", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PickBatchAdminResolver.prototype, "shipPickBatch", null);
exports.PickBatchAdminResolver = PickBatchAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [pick_batch_service_1.PickBatchService,
        core_1.TransactionalConnection])
], PickBatchAdminResolver);
//# sourceMappingURL=pick-batch.admin.resolver.js.map