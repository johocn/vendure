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
exports.ProductBundleService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const product_bundle_entity_1 = require("../entities/product-bundle.entity");
let ProductBundleService = class ProductBundleService {
    constructor(connection, listQueryBuilder, orderService, entityHydrator) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = orderService;
        this.entityHydrator = entityHydrator;
    }
    findAll(ctx, options, relations) {
        return this.listQueryBuilder
            .build(product_bundle_entity_1.ProductBundle, options, {
            relations,
            ctx,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            };
        });
    }
    findOne(ctx, id, relations) {
        return this.connection.getRepository(ctx, product_bundle_entity_1.ProductBundle).findOne({
            where: { id },
            relations,
        });
    }
    async create(ctx, input) {
        const newEntity = await this.connection.getRepository(ctx, product_bundle_entity_1.ProductBundle).save(input);
        return (0, core_1.assertFound)(this.findOne(ctx, newEntity.id));
    }
    async update(ctx, input) {
        const entity = await this.connection.getEntityOrThrow(ctx, product_bundle_entity_1.ProductBundle, input.id);
        const updatedEntity = (0, core_1.patchEntity)(entity, input);
        await this.connection.getRepository(ctx, product_bundle_entity_1.ProductBundle).save(updatedEntity, { reload: false });
        return (0, core_1.assertFound)(this.findOne(ctx, updatedEntity.id));
    }
    async delete(ctx, id) {
        const entity = await this.connection.getEntityOrThrow(ctx, product_bundle_entity_1.ProductBundle, id);
        try {
            await this.connection.getRepository(ctx, product_bundle_entity_1.ProductBundle).remove(entity);
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
    async addProductBundleToOrder(ctx, order, bundleId) {
        const bundle = await this.connection.getEntityOrThrow(ctx, product_bundle_entity_1.ProductBundle, bundleId, {
            relations: {
                items: true,
            },
        });
        const result = await this.orderService.addItemsToOrder(ctx, order.id, bundle.items.map(item => ({
            productVariantId: item.productVariant.id,
            quantity: item.quantity,
            customFields: {
                fromBundle: {
                    bundleId: bundleId.toString(),
                    bundleName: bundle.name,
                },
            },
        })));
        if (result.errorResults.length) {
            await this.connection.rollBackTransaction(ctx);
            return result.errorResults[0];
        }
        return result.order;
    }
    async removeProductBundleFromOrder(ctx, order, bundleId) {
        var _a, _b;
        await this.entityHydrator.hydrate(ctx, order, {
            relations: ['lines'],
        });
        const bundle = await this.connection.getEntityOrThrow(ctx, product_bundle_entity_1.ProductBundle, bundleId, {
            relations: {
                items: true,
            },
        });
        const adjustment = [];
        for (const line of order.lines) {
            if (((_b = (_a = line.customFields) === null || _a === void 0 ? void 0 : _a.fromBundle) === null || _b === void 0 ? void 0 : _b.bundleId) === bundleId.toString()) {
                const bundleItem = bundle.items.find(item => item.productVariant.id === line.productVariant.id);
                if (bundleItem) {
                    adjustment.push({
                        orderLineId: line.id,
                        quantity: -bundleItem.quantity,
                    });
                }
            }
        }
        const result = await this.orderService.adjustOrderLines(ctx, order.id, adjustment);
        if (result.errorResults.length) {
            await this.connection.rollBackTransaction(ctx);
            return result.errorResults[0];
        }
        return result.order;
    }
};
exports.ProductBundleService = ProductBundleService;
exports.ProductBundleService = ProductBundleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.OrderService,
        core_1.EntityHydrator])
], ProductBundleService);
//# sourceMappingURL=product-bundle.service.js.map