"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoSplitPlanService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const matrix_allocators_1 = require("./matrix-allocators");
let AutoSplitPlanService = class AutoSplitPlanService {
    init(injector) {
        this.injector = injector;
        this.connection = injector.get(core_1.TransactionalConnection);
    }
    async buildAutoPlan(ctx, orderId) {
        var _a, _b, _c;
        const order = await this.loadOrderWithLines(ctx, orderId);
        if (!order) {
            core_1.Logger.warn(`自动拆单 order#${orderId} 不存在，返回空计划`, matrix_allocators_1.loggerCtx);
            return { orderId, packages: [] };
        }
        const packages = new Map();
        for (const line of (_a = order.lines) !== null && _a !== void 0 ? _a : []) {
            const detail = this.parseSplitDetail((_b = line.customFields) === null || _b === void 0 ? void 0 : _b.stockLocationsJson);
            if (detail.length === 0) {
                continue;
            }
            for (const d of detail) {
                const locId = d.locationId;
                let pkg = packages.get(locId);
                if (!pkg) {
                    pkg = {
                        packageId: `P${packages.size + 1}`,
                        stockLocationId: locId,
                        lines: [],
                        estimatedShippingFee: 0,
                        deliveryMode: 'self',
                    };
                    packages.set(locId, pkg);
                }
                pkg.lines.push({ orderLineId: line.id, quantity: d.quantity });
            }
        }
        const result = { orderId, packages: [...packages.values()] };
        core_1.Logger.info(`自动拆单 order#${(_c = order === null || order === void 0 ? void 0 : order.code) !== null && _c !== void 0 ? _c : orderId} 共 ${result.packages.length} 包`, matrix_allocators_1.loggerCtx);
        return result;
    }
    parseSplitDetail(raw) {
        try {
            const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw !== null && raw !== void 0 ? raw : '[]'));
            return Array.isArray(arr) ? arr : [];
        }
        catch (_a) {
            return [];
        }
    }
    async loadOrderWithLines(ctx, orderId) {
        return this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['lines'],
        });
    }
};
exports.AutoSplitPlanService = AutoSplitPlanService;
exports.AutoSplitPlanService = AutoSplitPlanService = __decorate([
    (0, common_1.Injectable)()
], AutoSplitPlanService);
//# sourceMappingURL=auto-split-plan.service.js.map