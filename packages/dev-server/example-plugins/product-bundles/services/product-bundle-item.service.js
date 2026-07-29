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
exports.ProductBundleItemService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const product_bundle_item_entity_1 = require("../entities/product-bundle-item.entity");
const product_bundle_entity_1 = require("../entities/product-bundle.entity");
let ProductBundleItemService = class ProductBundleItemService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
    }
    async createProductBundleItem(ctx, input) {
        const bundle = await this.connection.getEntityOrThrow(ctx, product_bundle_entity_1.ProductBundle, input.bundleId);
        const newEntity = await this.connection.getRepository(ctx, product_bundle_item_entity_1.ProductBundleItem).save(new product_bundle_item_entity_1.ProductBundleItem(Object.assign(Object.assign({}, input), { bundle })));
        return newEntity;
    }
    async updateProductBundleItem(ctx, input) {
        const entity = await this.connection.getEntityOrThrow(ctx, product_bundle_item_entity_1.ProductBundleItem, input.id);
        const updatedEntity = (0, core_1.patchEntity)(entity, input);
        await this.connection.getRepository(ctx, product_bundle_item_entity_1.ProductBundleItem).save(updatedEntity, { reload: false });
        return updatedEntity;
    }
    async delete(ctx, id) {
        const entity = await this.connection.getEntityOrThrow(ctx, product_bundle_item_entity_1.ProductBundleItem, id);
        try {
            await this.connection.getRepository(ctx, product_bundle_item_entity_1.ProductBundleItem).remove(entity);
            return {
                result: generated_types_1.DeletionResult.DELETED,
            };
        }
        catch (e) {
            return {
                result: generated_types_1.DeletionResult.NOT_DELETED,
                message: e.toString(),
            };
        }
    }
};
exports.ProductBundleItemService = ProductBundleItemService;
exports.ProductBundleItemService = ProductBundleItemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], ProductBundleItemService);
//# sourceMappingURL=product-bundle-item.service.js.map