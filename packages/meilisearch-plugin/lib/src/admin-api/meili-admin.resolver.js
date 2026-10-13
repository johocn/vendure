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
exports.MeiliAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const meili_service_1 = require("../meili.service");
const product_sync_service_1 = require("../product-sync.service");
let MeiliAdminResolver = class MeiliAdminResolver {
    constructor(meili, sync) {
        this.meili = meili;
        this.sync = sync;
    }
    async meiliIndexStats() {
        // Meili 不可用时降级为空列表，不阻塞管理页
        const healthy = await this.meili.health();
        return healthy ? this.meili.stats() : [];
    }
    /**
     * 手动重建入口：CONTENTS/ALL 触发 Strapi 内容域全量（未配置 reindexUrl/sharedSecret 时返回 false 不报错）；
     * PRODUCTS/ALL 入队商品域全量重建 job（失败由 retries 兜底）。本 mutation 不写库。
     */
    async meiliReindex(scope) {
        let contentsTriggered = false;
        if (scope === 'CONTENTS' || scope === 'ALL') {
            contentsTriggered = await this.meili.triggerContentReindex();
        }
        let queued = false;
        if (scope === 'PRODUCTS' || scope === 'ALL') {
            await this.sync.enqueue(undefined);
            queued = true;
        }
        return { queued, contentsTriggered };
    }
};
exports.MeiliAdminResolver = MeiliAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MeiliAdminResolver.prototype, "meiliIndexStats", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(core_1.Permission.SuperAdmin),
    __param(0, (0, graphql_1.Args)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeiliAdminResolver.prototype, "meiliReindex", null);
exports.MeiliAdminResolver = MeiliAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [meili_service_1.MeiliService, product_sync_service_1.ProductSyncService])
], MeiliAdminResolver);
//# sourceMappingURL=meili-admin.resolver.js.map