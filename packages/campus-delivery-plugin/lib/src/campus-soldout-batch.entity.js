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
exports.CampusSoldOutBatch = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 全店沽清批次登记（§66）：只记录「通过全店沽清」被标记售罄的商品，
 * 次日 04:00 自动恢复时仅恢复这些商品，单品手动沽清不受影响。
 * 表由 migration p11-soldout-auto-restore 创建（生产 synchronize:false）。
 */
let CampusSoldOutBatch = class CampusSoldOutBatch extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusSoldOutBatch = CampusSoldOutBatch;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CampusSoldOutBatch.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CampusSoldOutBatch.prototype, "productId", void 0);
exports.CampusSoldOutBatch = CampusSoldOutBatch = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'productId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], CampusSoldOutBatch);
//# sourceMappingURL=campus-soldout-batch.entity.js.map