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
exports.InventoryModeService = void 0;
const common_1 = require("@nestjs/common");
const simple_inventory_adapter_1 = require("./simple-inventory.adapter");
const odoo_inventory_adapter_1 = require("./odoo-inventory.adapter");
/**
 * 库存管理模式开关：
 * - currentMode：读渠道自定义字段 inventoryMode（兜底 'simple'）
 * - assertSimple：odoo 模式下抛只读错误，用于单据落库门控
 * - getAdapter：按 currentMode 返回对应库存适配器（simple=本地 / odoo=预留 stub）
 */
let InventoryModeService = class InventoryModeService {
    constructor(simpleInventoryAdapter, odooInventoryAdapter) {
        this.simpleInventoryAdapter = simpleInventoryAdapter;
        this.odooInventoryAdapter = odooInventoryAdapter;
    }
    currentMode(ctx) {
        var _a, _b, _c;
        const mode = String((_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.inventoryMode) !== null && _c !== void 0 ? _c : 'simple');
        return mode === 'odoo' ? 'odoo' : 'simple';
    }
    assertSimple(ctx) {
        if (this.currentMode(ctx) === 'odoo') {
            throw new Error('Odoo 库存模式为只读，禁止直接落库单据');
        }
    }
    getAdapter(ctx) {
        return this.currentMode(ctx) === 'odoo' ? this.odooInventoryAdapter : this.simpleInventoryAdapter;
    }
};
exports.InventoryModeService = InventoryModeService;
exports.InventoryModeService = InventoryModeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [simple_inventory_adapter_1.SimpleInventoryAdapter,
        odoo_inventory_adapter_1.OdooInventoryAdapter])
], InventoryModeService);
//# sourceMappingURL=inventory-mode.service.js.map