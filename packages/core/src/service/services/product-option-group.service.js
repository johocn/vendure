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
exports.ProductOptionGroupService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const typeorm_1 = require("typeorm");
const common_2 = require("../../common");
const generated_graphql_admin_errors_1 = require("../../common/error/generated-graphql-admin-errors");
const instrument_decorator_1 = require("../../common/instrument-decorator");
const utils_1 = require("../../common/utils");
const transactional_connection_1 = require("../../connection/transactional-connection");
const product_option_group_translation_entity_1 = require("../../entity/product-option-group/product-option-group-translation.entity");
const product_option_group_entity_1 = require("../../entity/product-option-group/product-option-group.entity");
const product_option_entity_1 = require("../../entity/product-option/product-option.entity");
const product_variant_entity_1 = require("../../entity/product-variant/product-variant.entity");
const product_entity_1 = require("../../entity/product/product.entity");
const event_bus_1 = require("../../event-bus");
const product_option_group_event_1 = require("../../event-bus/events/product-option-group-event");
const custom_field_relation_service_1 = require("../helpers/custom-field-relation/custom-field-relation.service");
const list_query_builder_1 = require("../helpers/list-query-builder/list-query-builder");
const translatable_saver_1 = require("../helpers/translatable-saver/translatable-saver");
const translator_service_1 = require("../helpers/translator/translator.service");
const channel_service_1 = require("./channel.service");
const product_option_service_1 = require("./product-option.service");
const role_service_1 = require("./role.service");
/**
 * @description
 * Contains methods relating to {@link ProductOptionGroup} entities.
 *
 * @docsCategory services
 */
let ProductOptionGroupService = class ProductOptionGroupService {
    constructor(connection, translatableSaver, customFieldRelationService, productOptionService, eventBus, translator, listQueryBuilder, channelService, roleService) {
        this.connection = connection;
        this.translatableSaver = translatableSaver;
        this.customFieldRelationService = customFieldRelationService;
        this.productOptionService = productOptionService;
        this.eventBus = eventBus;
        this.translator = translator;
        this.listQueryBuilder = listQueryBuilder;
        this.channelService = channelService;
        this.roleService = roleService;
    }
    findAll(ctx, options, relations) {
        return this.listQueryBuilder
            .build(product_option_group_entity_1.ProductOptionGroup, options, {
            relations: relations !== null && relations !== void 0 ? relations : ['options'],
            ctx,
            channelId: ctx.channelId,
            where: {
                deletedAt: (0, typeorm_1.IsNull)(),
            },
        })
            .getManyAndCount()
            .then(([groups, totalItems]) => ({
            items: groups.map(group => this.translator.translate(group, ctx, ['options'])),
            totalItems,
        }));
    }
    findOne(ctx, id, relations, findOneOptions) {
        return this.connection
            .findOneInChannel(ctx, product_option_group_entity_1.ProductOptionGroup, id, ctx.channelId, {
            relations: relations !== null && relations !== void 0 ? relations : ['options'],
        })
            .then(group => {
            if (!group) {
                return undefined;
            }
            if (group.deletedAt && !(findOneOptions === null || findOneOptions === void 0 ? void 0 : findOneOptions.includeSoftDeleted)) {
                return undefined;
            }
            return this.translator.translate(group, ctx, ['options']);
        });
    }
    getOptionGroupsByProductId(ctx, id) {
        return this.connection
            .getRepository(ctx, product_option_group_entity_1.ProductOptionGroup)
            .createQueryBuilder('optionGroup')
            .leftJoinAndSelect('optionGroup.translations', 'translations')
            .leftJoinAndSelect('optionGroup.options', 'options')
            .leftJoinAndSelect('options.translations', 'optionTranslations')
            .innerJoin('optionGroup.products', 'product', 'product.id = :productId', { productId: id })
            .where('optionGroup.deletedAt IS NULL')
            .orderBy('optionGroup.id', 'ASC')
            .getMany()
            .then(groups => groups.map(group => this.translator.translate(group, ctx, ['options'])));
    }
    /**
     * @description
     * Returns all Channels to which the ProductOptionGroup is assigned.
     */
    async getOptionGroupChannels(ctx, optionGroupId) {
        const optionGroup = await this.connection.getEntityOrThrow(ctx, product_option_group_entity_1.ProductOptionGroup, optionGroupId, {
            relations: ['channels'],
            channelId: ctx.channelId,
        });
        return optionGroup.channels;
    }
    /**
     * @description
     * Returns the number of non-deleted Products in the current channel
     * that use the given ProductOptionGroup.
     */
    getProductCount(ctx, optionGroupId) {
        return this.connection
            .getRepository(ctx, product_entity_1.Product)
            .createQueryBuilder('product')
            .innerJoin('product.optionGroups', 'optionGroup', 'optionGroup.id = :optionGroupId', {
            optionGroupId,
        })
            .innerJoin('product.channels', 'channel', 'channel.id = :channelId', {
            channelId: ctx.channelId,
        })
            .where('product.deletedAt IS NULL')
            .getCount();
    }
    async create(ctx, input) {
        const group = await this.translatableSaver.create({
            ctx,
            input,
            entityType: product_option_group_entity_1.ProductOptionGroup,
            translationType: product_option_group_translation_entity_1.ProductOptionGroupTranslation,
            beforeSave: async (g) => {
                await this.channelService.assignToCurrentChannel(g, ctx);
            },
        });
        const groupWithRelations = await this.customFieldRelationService.updateRelations(ctx, product_option_group_entity_1.ProductOptionGroup, input, group);
        await this.eventBus.publish(new product_option_group_event_1.ProductOptionGroupEvent(ctx, groupWithRelations, 'created', input));
        return (0, utils_1.assertFound)(this.findOne(ctx, group.id));
    }
    async update(ctx, input) {
        const group = await this.translatableSaver.update({
            ctx,
            input,
            entityType: product_option_group_entity_1.ProductOptionGroup,
            translationType: product_option_group_translation_entity_1.ProductOptionGroupTranslation,
        });
        await this.customFieldRelationService.updateRelations(ctx, product_option_group_entity_1.ProductOptionGroup, input, group);
        await this.eventBus.publish(new product_option_group_event_1.ProductOptionGroupEvent(ctx, group, 'updated', input));
        return (0, utils_1.assertFound)(this.findOne(ctx, group.id));
    }
    /**
     * @description
     * Deletes a ProductOptionGroup. If the group is in use by any Products, the deletion
     * will fail unless `force` is set to `true`.
     */
    async delete(ctx, id, force = false) {
        var _a, _b, _c, _d;
        const optionGroup = await this.connection.getEntityOrThrow(ctx, product_option_group_entity_1.ProductOptionGroup, id, {
            relationLoadStrategy: 'query',
            loadEagerRelations: false,
            relations: ['options', 'products'],
            channelId: ctx.channelId,
        });
        const productCount = (_b = (_a = optionGroup.products) === null || _a === void 0 ? void 0 : _a.filter(p => p.deletedAt == null).length) !== null && _b !== void 0 ? _b : 0;
        if (productCount > 0 && !force) {
            return {
                result: generated_types_1.DeletionResult.NOT_DELETED,
                message: ctx.translate('message.product-option-group-used', {
                    code: optionGroup.code,
                    count: productCount,
                }),
            };
        }
        if (productCount > 0 && force) {
            // Detach from all products
            for (const product of optionGroup.products) {
                await this.connection
                    .getRepository(ctx, product_entity_1.Product)
                    .createQueryBuilder()
                    .relation('optionGroups')
                    .of(product.id)
                    .remove(id);
            }
        }
        const deletedOptionGroup = new product_option_group_entity_1.ProductOptionGroup(optionGroup);
        // Delete child options first
        const optionsToDelete = (_d = (_c = optionGroup.options) === null || _c === void 0 ? void 0 : _c.filter(o => !o.deletedAt)) !== null && _d !== void 0 ? _d : [];
        for (const option of optionsToDelete) {
            const { result, message } = await this.productOptionService.delete(ctx, option.id);
            if (result === generated_types_1.DeletionResult.NOT_DELETED) {
                return { result, message };
            }
        }
        const hasOptionsWhichAreInUse = await this.groupOptionsAreInUse(ctx, optionGroup);
        if (hasOptionsWhichAreInUse > 0) {
            // soft delete
            optionGroup.deletedAt = new Date();
            await this.connection.getRepository(ctx, product_option_group_entity_1.ProductOptionGroup).save(optionGroup, { reload: false });
        }
        else {
            // hard delete
            await this.connection.getRepository(ctx, product_option_group_entity_1.ProductOptionGroup).remove(optionGroup);
        }
        await this.eventBus.publish(new product_option_group_event_1.ProductOptionGroupEvent(ctx, deletedOptionGroup, 'deleted', id));
        return {
            result: generated_types_1.DeletionResult.DELETED,
        };
    }
    /**
     * @description
     * Deletes the ProductOptionGroup and any associated ProductOptions. If the ProductOptionGroup
     * is still referenced by a soft-deleted Product, then a soft-delete will be used to preserve
     * referential integrity. Otherwise a hard-delete will be performed.
     *
     * @deprecated Use {@link ProductOptionGroupService.delete} instead.
     */
    async deleteGroupAndOptionsFromProduct(ctx, id, productId) {
        const optionGroup = await this.connection.getEntityOrThrow(ctx, product_option_group_entity_1.ProductOptionGroup, id, {
            relationLoadStrategy: 'query',
            loadEagerRelations: false,
            relations: ['options', 'products'],
        });
        const deletedOptionGroup = new product_option_group_entity_1.ProductOptionGroup(optionGroup);
        const inUseByActiveProducts = await this.isInUseByOtherProducts(ctx, optionGroup, productId);
        if (inUseByActiveProducts > 0) {
            return {
                result: generated_types_1.DeletionResult.NOT_DELETED,
                message: ctx.translate('message.product-option-group-used', {
                    code: optionGroup.code,
                    count: inUseByActiveProducts,
                }),
            };
        }
        const optionsToDelete = optionGroup.options && optionGroup.options.filter(group => !group.deletedAt);
        for (const option of optionsToDelete) {
            const { result, message } = await this.productOptionService.delete(ctx, option.id);
            if (result === generated_types_1.DeletionResult.NOT_DELETED) {
                await this.connection.rollBackTransaction(ctx);
                return { result, message };
            }
        }
        const hasOptionsWhichAreInUse = await this.groupOptionsAreInUse(ctx, optionGroup);
        if (hasOptionsWhichAreInUse > 0) {
            // soft delete
            optionGroup.deletedAt = new Date();
            await this.connection.getRepository(ctx, product_option_group_entity_1.ProductOptionGroup).save(optionGroup, { reload: false });
        }
        else {
            // hard delete
            const product = await this.connection.getRepository(ctx, product_entity_1.Product).findOne({
                relationLoadStrategy: 'query',
                loadEagerRelations: false,
                where: { id: productId },
                relations: ['optionGroups'],
            });
            if (product) {
                product.optionGroups = product.optionGroups.filter(og => !(0, utils_1.idsAreEqual)(og.id, id));
                await this.connection.getRepository(ctx, product_entity_1.Product).save(product, { reload: false });
            }
            await this.connection.getRepository(ctx, product_option_group_entity_1.ProductOptionGroup).remove(optionGroup);
        }
        await this.eventBus.publish(new product_option_group_event_1.ProductOptionGroupEvent(ctx, deletedOptionGroup, 'deleted', id));
        return {
            result: generated_types_1.DeletionResult.DELETED,
        };
    }
    /**
     * @description
     * Assigns ProductOptionGroups to the specified Channel
     */
    async assignProductOptionGroupsToChannel(ctx, input) {
        const hasPermission = await this.roleService.userHasAnyPermissionsOnChannel(ctx, input.channelId, [
            generated_types_1.Permission.UpdateCatalog,
            generated_types_1.Permission.UpdateProduct,
        ]);
        if (!hasPermission) {
            throw new common_2.ForbiddenError();
        }
        const groupsToAssign = await this.connection
            .getRepository(ctx, product_option_group_entity_1.ProductOptionGroup)
            .find({ where: { id: (0, typeorm_1.In)(input.productOptionGroupIds) }, relations: ['options'] });
        const optionsToAssign = groupsToAssign.reduce((options, group) => [...options, ...group.options], []);
        await Promise.all([
            ...groupsToAssign.map(group => this.channelService.assignToChannels(ctx, product_option_group_entity_1.ProductOptionGroup, group.id, [input.channelId])),
            ...optionsToAssign.map(option => this.channelService.assignToChannels(ctx, product_option_entity_1.ProductOption, option.id, [input.channelId])),
        ]);
        return this.connection
            .findByIdsInChannel(ctx, product_option_group_entity_1.ProductOptionGroup, groupsToAssign.map(g => g.id), ctx.channelId, {})
            .then(groups => groups.map(group => this.translator.translate(group, ctx, ['options'])));
    }
    /**
     * @description
     * Removes ProductOptionGroups from the specified Channel
     */
    async removeProductOptionGroupsFromChannel(ctx, input) {
        const hasPermission = await this.roleService.userHasAnyPermissionsOnChannel(ctx, input.channelId, [
            generated_types_1.Permission.DeleteCatalog,
            generated_types_1.Permission.DeleteProduct,
        ]);
        if (!hasPermission) {
            throw new common_2.ForbiddenError();
        }
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        if ((0, utils_1.idsAreEqual)(input.channelId, defaultChannel.id)) {
            throw new common_2.UserInputError('error.items-cannot-be-removed-from-default-channel');
        }
        const groupsToRemove = await this.connection
            .getRepository(ctx, product_option_group_entity_1.ProductOptionGroup)
            .find({ where: { id: (0, typeorm_1.In)(input.productOptionGroupIds) }, relations: ['options'] });
        const results = [];
        for (const group of groupsToRemove) {
            // Check if this group is in use by products in the target channel
            const productCount = await this.connection
                .getRepository(ctx, product_entity_1.Product)
                .createQueryBuilder('product')
                .innerJoin('product.optionGroups', 'optionGroup', 'optionGroup.id = :groupId', {
                groupId: group.id,
            })
                .innerJoin('product.channels', 'channel', 'channel.id = :channelId', {
                channelId: input.channelId,
            })
                .where('product.deletedAt IS NULL')
                .getCount();
            const variantCount = await this.connection
                .getRepository(ctx, product_variant_entity_1.ProductVariant)
                .createQueryBuilder('variant')
                .leftJoin('variant.options', 'option')
                .innerJoin('variant.channels', 'channel', 'channel.id = :channelId', {
                channelId: input.channelId,
            })
                .where('option.groupId = :groupId', { groupId: group.id })
                .andWhere('variant.deletedAt IS NULL')
                .getCount();
            const isInUse = !!(productCount || variantCount);
            if (!isInUse || input.force) {
                await this.channelService.removeFromChannels(ctx, product_option_group_entity_1.ProductOptionGroup, group.id, [
                    input.channelId,
                ]);
                await Promise.all(group.options.map(option => this.channelService.removeFromChannels(ctx, product_option_entity_1.ProductOption, option.id, [
                    input.channelId,
                ])));
                const result = await this.findOne(ctx, group.id);
                if (result) {
                    results.push(result);
                }
            }
            else {
                results.push(new generated_graphql_admin_errors_1.ProductOptionGroupInUseError({
                    optionGroupCode: group.code,
                    productCount,
                    variantCount,
                }));
            }
        }
        return results;
    }
    async isInUseByOtherProducts(ctx, productOptionGroup, targetProductId) {
        return this.connection
            .getRepository(ctx, product_entity_1.Product)
            .createQueryBuilder('product')
            .leftJoin('product.optionGroups', 'optionGroup')
            .where('product.deletedAt IS NULL')
            .andWhere('optionGroup.id = :id', { id: productOptionGroup.id })
            .andWhere('product.id != :productId', { productId: targetProductId })
            .getCount();
    }
    async groupOptionsAreInUse(ctx, productOptionGroup) {
        return this.connection
            .getRepository(ctx, product_variant_entity_1.ProductVariant)
            .createQueryBuilder('variant')
            .leftJoin('variant.options', 'option')
            .where('option.groupId = :groupId', { groupId: productOptionGroup.id })
            .getCount();
    }
};
exports.ProductOptionGroupService = ProductOptionGroupService;
exports.ProductOptionGroupService = ProductOptionGroupService = __decorate([
    (0, common_1.Injectable)(),
    (0, instrument_decorator_1.Instrument)(),
    __metadata("design:paramtypes", [transactional_connection_1.TransactionalConnection,
        translatable_saver_1.TranslatableSaver,
        custom_field_relation_service_1.CustomFieldRelationService,
        product_option_service_1.ProductOptionService,
        event_bus_1.EventBus,
        translator_service_1.TranslatorService,
        list_query_builder_1.ListQueryBuilder,
        channel_service_1.ChannelService,
        role_service_1.RoleService])
], ProductOptionGroupService);
//# sourceMappingURL=product-option-group.service.js.map