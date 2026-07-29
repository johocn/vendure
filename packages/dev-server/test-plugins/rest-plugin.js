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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestPlugin = exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let ProductsController = class ProductsController {
    constructor(productService) {
        this.productService = productService;
    }
    findAll(ctx) {
        return this.productService.findAll(ctx);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findAll", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [core_1.ProductService])
], ProductsController);
/**
 * A proof-of-concept plugin which adds a REST endpoint for querying products.
 */
let RestPlugin = class RestPlugin {
};
exports.RestPlugin = RestPlugin;
exports.RestPlugin = RestPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [ProductsController],
    })
], RestPlugin);
//# sourceMappingURL=rest-plugin.js.map