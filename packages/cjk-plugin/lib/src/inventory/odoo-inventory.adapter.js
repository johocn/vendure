"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooInventoryAdapter = void 0;
const common_1 = require("@nestjs/common");
/**
 * Odoo 适配器（预留 stub，不实现真实 HTTP 调用）。
 * 后续对接 Odoo xmlrpc/jsonrpc：fetchStock 查询 Odoo 库存，fetchCost 查询 Odoo 成本。
 * 当前返回示例数据，便于前端联调 shape。
 */
let OdooInventoryAdapter = class OdooInventoryAdapter {
    constructor() {
        this.mode = 'odoo';
    }
    async fetchStock(_ctx, variantId, _locationId) {
        return [{ variantId, locationId: 0, onHand: 0, costPrice: null }];
    }
    async fetchCost(_ctx, _variantId, _locationId) {
        return null;
    }
};
exports.OdooInventoryAdapter = OdooInventoryAdapter;
exports.OdooInventoryAdapter = OdooInventoryAdapter = __decorate([
    (0, common_1.Injectable)()
], OdooInventoryAdapter);
//# sourceMappingURL=odoo-inventory.adapter.js.map