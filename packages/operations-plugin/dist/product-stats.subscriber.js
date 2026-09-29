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
exports.ProductStatsSubscriber = void 0;
// d:\zhao\vendure\packages\operations-plugin\src\product-stats.subscriber.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const product_stats_service_1 = require("./product-stats.service");
/**
 * @description
 * 后台改动即时生效：运营改完 bonusSales / pointsRewardOverride，或改完变体价格后，
 * 立刻重算该商品的展示值，不必等次日定时任务。
 *
 * 自激防护：ProductStatsService 写前比对，值无变化则不写库、不发事件，循环最多一轮即终止。
 */
let ProductStatsSubscriber = class ProductStatsSubscriber {
    constructor(eventBus, productStatsService, requestContextService) {
        this.eventBus = eventBus;
        this.productStatsService = productStatsService;
        this.requestContextService = requestContextService;
    }
    onApplicationBootstrap() {
        this.eventBus.ofType(core_1.ProductEvent).subscribe(event => {
            if (event.type !== 'created' && event.type !== 'updated') {
                return;
            }
            void this.recomputeForProduct(event.entity.id);
        });
        this.eventBus.ofType(core_1.ProductVariantEvent).subscribe(event => {
            if (event.type !== 'created' && event.type !== 'updated' && event.type !== 'deleted') {
                return;
            }
            const productId = event.entity.productId;
            void this.recomputeForProduct(productId);
        });
    }
    async recomputeForProduct(productId) {
        var _a;
        if (productId == null) {
            return;
        }
        try {
            // 用新建的非事务 ctx：事件可能在事务中发出，复用事件 ctx 会把重算卷进该事务。
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            await this.productStatsService.recomputeForProducts(ctx, [productId]);
        }
        catch (err) {
            core_1.Logger.error(`Product stats recompute failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, constants_1.loggerCtx);
        }
    }
};
exports.ProductStatsSubscriber = ProductStatsSubscriber;
exports.ProductStatsSubscriber = ProductStatsSubscriber = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.EventBus,
        product_stats_service_1.ProductStatsService,
        core_1.RequestContextService])
], ProductStatsSubscriber);
