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
var MeiliSearchPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeiliSearchPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const meili_service_1 = require("./meili.service");
const product_sync_service_1 = require("./product-sync.service");
let MeiliSearchPlugin = MeiliSearchPlugin_1 = class MeiliSearchPlugin {
    constructor(options, meiliService, productSync, eventBus) {
        this.options = options;
        this.meiliService = meiliService;
        this.productSync = productSync;
        this.eventBus = eventBus;
    }
    static init(options) {
        MeiliSearchPlugin_1.options = options;
        return MeiliSearchPlugin_1;
    }
    async onApplicationBootstrap() {
        try {
            await this.productSync.initQueue();
        }
        catch (e) {
            core_1.Logger.error(`MeiliSearchPlugin queue init failed: ${String(e)}`, constants_1.loggerCtx);
        }
        this.subscribeEvents();
        try {
            await this.meiliService.ensureIndexes();
            core_1.Logger.info('MeiliSearchPlugin initialized', constants_1.loggerCtx);
        }
        catch (e) {
            // Meili 不可用不阻塞 Vendure 启动，降级为日志（同步 job 失败靠 retries 重试）
            core_1.Logger.error(`MeiliSearchPlugin bootstrap failed: ${String(e)}`, constants_1.loggerCtx);
        }
    }
    subscribeEvents() {
        // 商品增改 → 入队增量同步；删除 → 直接清理各语言索引文档（删除事件实体可能只剩 id）
        this.eventBus.ofType(core_1.ProductEvent).subscribe(event => {
            void this.onProductEvent(event);
        });
        // 变体增改删 → 取 productId 入队（entity 为变体数组；删除事件可能只剩 id，productId 列仍在）
        this.eventBus.ofType(core_1.ProductVariantEvent).subscribe(event => {
            void this.onVariantEvent(event);
        });
    }
    async onProductEvent(event) {
        try {
            const productId = String(event.entity.id);
            if (event.type === 'deleted') {
                await this.productSync.removeProduct(productId);
            }
            else {
                await this.productSync.enqueue([productId]);
            }
        }
        catch (e) {
            core_1.Logger.error(`MeiliSearchPlugin ProductEvent(${event.type}) failed: ${String(e)}`, constants_1.loggerCtx);
        }
    }
    async onVariantEvent(event) {
        var _a;
        try {
            const productIds = [
                ...new Set(((_a = event.entity) !== null && _a !== void 0 ? _a : [])
                    .map(v => { var _a, _b; return (_a = v === null || v === void 0 ? void 0 : v.productId) !== null && _a !== void 0 ? _a : (_b = v === null || v === void 0 ? void 0 : v.product) === null || _b === void 0 ? void 0 : _b.id; })
                    .filter((id) => id != null)
                    .map(id => String(id))),
            ];
            if (!productIds.length)
                return;
            for (const productId of productIds) {
                await this.productSync.enqueue([productId]);
            }
        }
        catch (e) {
            core_1.Logger.error(`MeiliSearchPlugin ProductVariantEvent(${event.type}) failed: ${String(e)}`, constants_1.loggerCtx);
        }
    }
};
exports.MeiliSearchPlugin = MeiliSearchPlugin;
exports.MeiliSearchPlugin = MeiliSearchPlugin = MeiliSearchPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.MEILI_PLUGIN_OPTIONS, useFactory: () => MeiliSearchPlugin.options },
            meili_service_1.MeiliService,
            product_sync_service_1.ProductSyncService,
        ],
        exports: [meili_service_1.MeiliService],
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.MEILI_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, meili_service_1.MeiliService,
        product_sync_service_1.ProductSyncService,
        core_1.EventBus])
], MeiliSearchPlugin);
//# sourceMappingURL=plugin.js.map