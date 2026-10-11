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
exports.DiyStockService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const diy_material_entity_1 = require("./entities/diy-material.entity");
/**
 * 素材库存（偏差 3：DB 原子 UPDATE 替代 Redis 锁）：
 * `stock = stock - qty WHERE id = ? AND stock >= qty` 单语句原子，affected=0 即缺口。
 * deduct 全有或全无：任一缺口先回补已扣行，再返回缺口明细（不抛错，由调用方转 UserInputError）。
 * 库存归属：BOM.materialId 指向合并视图行——未复制的平台行扣平台库存，租户复制行扣租户库存（规格 §4.3）。
 * ctx 可传 undefined（事件订阅者等无 ctx 场景，走默认连接）。
 */
let DiyStockService = class DiyStockService {
    constructor(connection) {
        this.connection = connection;
    }
    async deduct(ctx, items) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        const deducted = [];
        const shortages = [];
        for (const item of items) {
            const qty = Math.floor(item.qty);
            const result = await repo
                .createQueryBuilder()
                .update(diy_material_entity_1.DiyMaterial)
                .set({ stock: () => `stock - ${qty}` })
                .where('id = :id AND stock >= :qty', { id: item.materialId, qty })
                .execute();
            if (result.affected) {
                deducted.push(item);
            }
            else {
                const material = await repo.findOne({ where: { id: item.materialId } });
                shortages.push({
                    materialId: item.materialId,
                    code: (_a = material === null || material === void 0 ? void 0 : material.code) !== null && _a !== void 0 ? _a : String(item.materialId),
                    required: qty,
                    available: (_b = material === null || material === void 0 ? void 0 : material.stock) !== null && _b !== void 0 ? _b : 0,
                });
            }
        }
        if (shortages.length) {
            await this.restock(ctx, deducted);
        }
        return shortages;
    }
    async restock(ctx, items) {
        if (!items.length) {
            return;
        }
        const repo = this.connection.getRepository(ctx, diy_material_entity_1.DiyMaterial);
        for (const item of items) {
            const qty = Math.floor(item.qty);
            await repo
                .createQueryBuilder()
                .update(diy_material_entity_1.DiyMaterial)
                .set({ stock: () => `stock + ${qty}` })
                .where('id = :id', { id: item.materialId })
                .execute();
        }
    }
};
exports.DiyStockService = DiyStockService;
exports.DiyStockService = DiyStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], DiyStockService);
//# sourceMappingURL=diy-stock.service.js.map