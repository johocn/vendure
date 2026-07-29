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
exports.SupplierStockService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const supplier_stock_entity_1 = require("../../entities/supplier-stock.entity");
let SupplierStockService = class SupplierStockService {
    constructor(listQueryBuilder) {
        this.listQueryBuilder = listQueryBuilder;
    }
    findAll(ctx, options, relations) {
        return this.listQueryBuilder
            .build(supplier_stock_entity_1.SupplierStock, options, {
            ctx,
            relations: relations !== null && relations !== void 0 ? relations : [
                'product',
                'productVariant',
                'supplier',
                'stocksInTransits',
            ],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            };
        });
    }
};
exports.SupplierStockService = SupplierStockService;
exports.SupplierStockService = SupplierStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ListQueryBuilder])
], SupplierStockService);
//# sourceMappingURL=supplier-stock.service.js.map