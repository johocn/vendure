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
exports.StocktakeAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const stocktake_service_1 = require("./stocktake.service");
/** 差异视图：service 返回 { summary, rows, ... }，SDL 要扁平字段，故此处统一映射 */
function toDiffView(d) {
    return {
        expectedTotal: d.summary.expectedTotal,
        countedTotal: d.summary.countedLineCount,
        uncountedCount: d.summary.uncountedCount,
        extraCount: d.summary.extraCount,
        diffCount: d.summary.byVariant.filter((v) => v.diff !== 0).length,
        rows: d.rows,
        uncountedLines: d.uncountedLines,
        recheck: d.summary.recheck,
        changedVariants: d.changedVariants,
    };
}
let StocktakeAdminResolver = class StocktakeAdminResolver {
    constructor(stocktakeService, connection) {
        this.stocktakeService = stocktakeService;
        this.connection = connection;
    }
    // ---------------------------------------------------------- 查询
    async stocktakeTasks(ctx, args) {
        return this.stocktakeService.listTasks(ctx, args.options);
    }
    async stocktakeTask(ctx, args) {
        return this.stocktakeService.getTask(ctx, args.id);
    }
    async stocktakeWaves(ctx, args) {
        return this.stocktakeService.listWaves(ctx, args.taskId);
    }
    async stocktakeExpectedLines(ctx, args) {
        return this.stocktakeService.listLines(ctx, args);
    }
    async stocktakeDiff(ctx, args) {
        return toDiffView(await this.stocktakeService.diffOf(ctx, args.taskId));
    }
    async stocktakeResolveCode(ctx, args) {
        return this.stocktakeService.resolveCode(ctx, args.taskId, args.code);
    }
    async stocktakeStats(ctx, args) {
        return this.stocktakeService.statsOf(ctx, args.taskId);
    }
    async stocktakeExport(ctx, args) {
        return this.stocktakeService.exportOf(ctx, args.taskId, String(args.kind));
    }
    // ---------------------------------------------------------- 变更
    async createStocktakeTask(ctx, args) {
        return this.stocktakeService.createTask(ctx, args.input);
    }
    async openStocktakeTask(ctx, args) {
        return this.stocktakeService.openTask(ctx, args.taskId);
    }
    async updateStocktakeTask(ctx, args) {
        return this.stocktakeService.updateTask(ctx, args.taskId, args.input);
    }
    async addStocktakeWave(ctx, args) {
        return this.stocktakeService.addWave(ctx, args.taskId, args.input);
    }
    async assignStocktakeWave(ctx, args) {
        return this.stocktakeService.assignWave(ctx, args.waveId, args.assigneeId);
    }
    async claimStocktakeWave(ctx, args) {
        return this.stocktakeService.claimWave(ctx, args.waveId);
    }
    async releaseStocktakeWave(ctx, args) {
        return this.stocktakeService.releaseWave(ctx, args.waveId);
    }
    async saveStocktakeCounts(ctx, args) {
        return this.stocktakeService.saveCounts(ctx, args.waveId, args.inputs);
    }
    async submitStocktakeWave(ctx, args) {
        return this.stocktakeService.submitWave(ctx, args.waveId);
    }
    async postStocktake(ctx, args) {
        const r = await this.stocktakeService.post(ctx, args.taskId, args.confirm);
        return Object.assign(Object.assign({}, r), { diff: r.diff ? toDiffView(r.diff) : null });
    }
    async cancelStocktakeTask(ctx, args) {
        return this.stocktakeService.cancelTask(ctx, args.taskId);
    }
    async cancelStocktakeWave(ctx, args) {
        return this.stocktakeService.cancelWave(ctx, args.waveId);
    }
};
exports.StocktakeAdminResolver = StocktakeAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeTasks", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeTask", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeWaves", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeExpectedLines", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeDiff", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeResolveCode", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeStats", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "stocktakeExport", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "createStocktakeTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "openStocktakeTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "updateStocktakeTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "addStocktakeWave", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "assignStocktakeWave", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "claimStocktakeWave", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "releaseStocktakeWave", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "saveStocktakeCounts", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "submitStocktakeWave", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakePost'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "postStocktake", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "cancelStocktakeTask", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)('StocktakeCount'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StocktakeAdminResolver.prototype, "cancelStocktakeWave", null);
exports.StocktakeAdminResolver = StocktakeAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [stocktake_service_1.StocktakeService,
        core_1.TransactionalConnection])
], StocktakeAdminResolver);
//# sourceMappingURL=stocktake.admin.resolver.js.map