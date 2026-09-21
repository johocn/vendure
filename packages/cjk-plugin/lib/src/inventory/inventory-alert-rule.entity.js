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
exports.InventoryAlertRuleEntity = void 0;
const typeorm_1 = require("typeorm");
/**
 * 库存预警规则（安全库存）。
 *
 * 唯一键 `(tenantChannelId, variantId, locationId)`；`locationId = 0` 为**哨兵值**，
 * 语义 =「该 SKU 在本租户全部仓通用」，不用 nullable 以规避不同数据库对 NULL 唯一索引的差异。
 * `safetyStock = 0` 合法，语义 = 该 SKU 不再进入低库存预警。
 */
let InventoryAlertRuleEntity = class InventoryAlertRuleEntity {
};
exports.InventoryAlertRuleEntity = InventoryAlertRuleEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment'),
    __metadata("design:type", Number)
], InventoryAlertRuleEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InventoryAlertRuleEntity.prototype, "tenantChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], InventoryAlertRuleEntity.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InventoryAlertRuleEntity.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 10 }),
    __metadata("design:type", Number)
], InventoryAlertRuleEntity.prototype, "safetyStock", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], InventoryAlertRuleEntity.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], InventoryAlertRuleEntity.prototype, "updatedAt", void 0);
exports.InventoryAlertRuleEntity = InventoryAlertRuleEntity = __decorate([
    (0, typeorm_1.Entity)('inventory_alert_rule'),
    (0, typeorm_1.Index)('uq_inventory_alert_rule_scope', ['tenantChannelId', 'variantId', 'locationId'], { unique: true })
], InventoryAlertRuleEntity);
//# sourceMappingURL=inventory-alert-rule.entity.js.map