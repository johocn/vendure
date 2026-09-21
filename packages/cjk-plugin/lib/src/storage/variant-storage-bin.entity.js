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
exports.VariantStorageBin = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * SKU–库位绑定。三档开关共表：
 * - bin 档：zoneId + binId 都写
 * - zone 档：只写 zoneId，binId 为 null
 * - off 档：本表不使用（但表始终存在）
 */
let VariantStorageBin = class VariantStorageBin extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.VariantStorageBin = VariantStorageBin;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], VariantStorageBin.prototype, "tenantChannelId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], VariantStorageBin.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], VariantStorageBin.prototype, "stockLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], VariantStorageBin.prototype, "zoneId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], VariantStorageBin.prototype, "binId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], VariantStorageBin.prototype, "isDefault", void 0);
exports.VariantStorageBin = VariantStorageBin = __decorate([
    (0, typeorm_1.Entity)('variant_storage_bin'),
    (0, typeorm_1.Unique)(['tenantChannelId', 'variantId', 'stockLocationId']),
    __metadata("design:paramtypes", [Object])
], VariantStorageBin);
//# sourceMappingURL=variant-storage-bin.entity.js.map