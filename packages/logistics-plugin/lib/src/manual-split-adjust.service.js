"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualSplitAdjustService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const matrix_allocators_1 = require("./matrix-allocators");
let ManualSplitAdjustService = class ManualSplitAdjustService {
    init(injector) {
        this.injector = injector;
        this.connection = injector.get(core_1.TransactionalConnection);
        try {
            this.stockLevelService = injector.get(core_1.StockLevelService);
        }
        catch (_a) {
            /* 可售校验降级：无 StockLevelService 时跳过校验 */
        }
    }
    /**
     * 应用管理员调整：packages 每行数量守恒校验 + 每仓可售校验，产出最终计划。
     * @param packages 管理员提交的每包行明细（改仓 = 调整 stockLocationId 分组）
     */
    async applyAdjustment(ctx, orderId, packages) {
        var _a, _b, _c, _d, _e;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['lines'],
        });
        const originalQty = new Map();
        for (const line of ((_a = order === null || order === void 0 ? void 0 : order.lines) !== null && _a !== void 0 ? _a : [])) {
            originalQty.set(String(line.id), line.quantity);
        }
        const sumQty = new Map();
        for (const pkg of packages) {
            for (const l of pkg.lines) {
                const k = String(l.orderLineId);
                sumQty.set(k, ((_b = sumQty.get(k)) !== null && _b !== void 0 ? _b : 0) + l.quantity);
            }
        }
        for (const [lineId, qty] of originalQty) {
            if (((_c = sumQty.get(lineId)) !== null && _c !== void 0 ? _c : 0) !== qty) {
                throw new core_1.UserInputError(`行 ${lineId} 数量不守恒：原 ${qty}，调整后 ${(_d = sumQty.get(lineId)) !== null && _d !== void 0 ? _d : 0}`);
            }
        }
        await this.assertStockSufficient(ctx, packages);
        const result = {
            orderId,
            packages: packages.map((p, i) => ({
                packageId: `P${i + 1}`,
                stockLocationId: p.stockLocationId,
                lines: p.lines,
                estimatedShippingFee: 0,
                deliveryMode: 'self',
            })),
        };
        core_1.Logger.info(`手动调单 order#${(_e = order === null || order === void 0 ? void 0 : order.code) !== null && _e !== void 0 ? _e : orderId} 确认 ${result.packages.length} 包`, matrix_allocators_1.loggerCtx);
        return result;
    }
    async assertStockSufficient(ctx, packages) {
        var _a, _b;
        const byLoc = new Map();
        for (const pkg of packages) {
            for (const l of pkg.lines) {
                const k = String(l.orderLineId);
                if (!byLoc.has(pkg.stockLocationId)) {
                    byLoc.set(pkg.stockLocationId, new Map());
                }
                const m = byLoc.get(pkg.stockLocationId);
                m.set(k, ((_a = m.get(k)) !== null && _a !== void 0 ? _a : 0) + l.quantity);
            }
        }
        for (const [locId, lines] of byLoc) {
            for (const [lineId, qty] of lines) {
                const line = await this.connection.getRepository(ctx, core_1.OrderLine).findOne({
                    where: { id: lineId },
                });
                const variantId = line.productVariantId;
                const level = await this.getStockLevel(ctx, variantId, locId);
                // 手动调单是对本订单自身分配的重新编排：本单已分配量（stockAllocated）会随确认被重排，
                // 因此以该仓物理货量 onHand 作为上限（不允许把一个仓调到超过其实际库存），
                // 而不是扣除本单自身已分配后的"可售"，否则系统自动拆出的同一计划都无法通过校验。
                const onHand = (_b = level === null || level === void 0 ? void 0 : level.stockOnHand) !== null && _b !== void 0 ? _b : 0;
                if (onHand < qty) {
                    throw new core_1.UserInputError(`仓 ${locId} 对行 ${lineId} 货量不足：需 ${qty}，仓内 ${onHand}`);
                }
            }
        }
    }
    async getStockLevel(ctx, variantId, locationId) {
        var _a;
        if (!this.stockLevelService) {
            return undefined;
        }
        try {
            return await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        }
        catch (e) {
            core_1.Logger.warn(`可售校验读取失败: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, matrix_allocators_1.loggerCtx);
            return undefined;
        }
    }
};
exports.ManualSplitAdjustService = ManualSplitAdjustService;
exports.ManualSplitAdjustService = ManualSplitAdjustService = __decorate([
    (0, common_1.Injectable)()
], ManualSplitAdjustService);
//# sourceMappingURL=manual-split-adjust.service.js.map