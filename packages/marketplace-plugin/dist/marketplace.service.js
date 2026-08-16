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
exports.MarketplaceService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let MarketplaceService = class MarketplaceService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 校验条形码在平台内唯一（跨所有 Channel）。返回所属 ProductId 与首个 VariantId；空则无冲突。 */
    async findBarcodeOwner(barcode) {
        if (!barcode)
            return null;
        const repo = this.connection.rawConnection.getRepository(core_1.Product);
        const product = await repo
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.customFields', 'cf')
            .leftJoinAndSelect('product.variants', 'variant')
            .where('cf.barcode = :barcode', { barcode })
            .getOne();
        if (!product || !product.variants || product.variants.length === 0) {
            return null;
        }
        return { productId: product.id, variantId: product.variants[0].id };
    }
    /** 保存前校验：若 barcode 已被其他商品占用则抛错 */
    async assertBarcodeUnique(barcode, excludeProductId) {
        const owner = await this.findBarcodeOwner(barcode);
        if (owner && (!excludeProductId || owner.productId !== excludeProductId)) {
            throw new core_1.UserInputError(`条形码 ${barcode} 已被占用`);
        }
    }
};
exports.MarketplaceService = MarketplaceService;
exports.MarketplaceService = MarketplaceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MarketplaceService);
