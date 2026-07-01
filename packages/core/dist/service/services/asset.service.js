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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const omit_1 = require("@vendure/common/lib/omit");
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const unique_1 = require("@vendure/common/lib/unique");
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const http_1 = require("http");
const image_size_1 = require("image-size");
const mime_types_1 = __importDefault(require("mime-types"));
const path_1 = __importDefault(require("path"));
const typeorm_1 = require("typeorm");
const StringUtils_1 = require("typeorm/util/StringUtils");
const request_context_1 = require("../../api/common/request-context");
const common_2 = require("../../common");
const error_result_1 = require("../../common/error/error-result");
const errors_1 = require("../../common/error/errors");
const generated_graphql_admin_errors_1 = require("../../common/error/generated-graphql-admin-errors");
const utils_1 = require("../../common/utils");
const config_service_1 = require("../../config/config.service");
const vendure_logger_1 = require("../../config/logger/vendure-logger");
const transactional_connection_1 = require("../../connection/transactional-connection");
const asset_translation_entity_1 = require("../../entity/asset/asset-translation.entity");
const asset_entity_1 = require("../../entity/asset/asset.entity");
const collection_entity_1 = require("../../entity/collection/collection.entity");
const product_variant_entity_1 = require("../../entity/product-variant/product-variant.entity");
const product_entity_1 = require("../../entity/product/product.entity");
const event_bus_1 = require("../../event-bus/event-bus");
const asset_channel_event_1 = require("../../event-bus/events/asset-channel-event");
const asset_event_1 = require("../../event-bus/events/asset-event");
const custom_field_relation_service_1 = require("../helpers/custom-field-relation/custom-field-relation.service");
const list_query_builder_1 = require("../helpers/list-query-builder/list-query-builder");
const translatable_saver_1 = require("../helpers/translatable-saver/translatable-saver");
const translator_service_1 = require("../helpers/translator/translator.service");
const patch_entity_1 = require("../helpers/utils/patch-entity");
const channel_service_1 = require("./channel.service");
const role_service_1 = require("./role.service");
const tag_service_1 = require("./tag.service");
/**
 * @description
 * Contains methods relating to {@link Asset} entities.
 *
 * @docsCategory services
 * @docsWeight 0
 */
let AssetService = class AssetService {
    constructor(connection, configService, listQueryBuilder, eventBus, tagService, channelService, roleService, customFieldRelationService, translatableSaver, translator) {
        this.connection = connection;
        this.configService = configService;
        this.listQueryBuilder = listQueryBuilder;
        this.eventBus = eventBus;
        this.tagService = tagService;
        this.channelService = channelService;
        this.roleService = roleService;
        this.customFieldRelationService = customFieldRelationService;
        this.translatableSaver = translatableSaver;
        this.translator = translator;
        this.permittedMimeTypes = [];
        this.permittedMimeTypes = this.configService.assetOptions.permittedFileTypes
            .map(val => (/\.[\w]+/.test(val) ? mime_types_1.default.lookup(val) || undefined : val))
            .filter(shared_utils_1.notNullOrUndefined)
            .map(val => {
            const [type, subtype] = val.split('/');
            return { type, subtype };
        });
    }
    findOne(ctx, id, relations) {
        return this.connection
            .findOneInChannel(ctx, asset_entity_1.Asset, id, ctx.channelId, {
            relations: relations !== null && relations !== void 0 ? relations : [],
        })
            .then(result => (result ? this.translator.translate(result, ctx) : undefined));
    }
    findAll(ctx, options, relations) {
        var _a;
        const qb = this.listQueryBuilder.build(asset_entity_1.Asset, options, {
            ctx,
            relations: [...(relations !== null && relations !== void 0 ? relations : []), 'tags'],
            channelId: ctx.channelId,
        });
        const tags = options === null || options === void 0 ? void 0 : options.tags;
        if (tags && tags.length) {
            const operator = (_a = options === null || options === void 0 ? void 0 : options.tagsOperator) !== null && _a !== void 0 ? _a : generated_types_1.LogicalOperator.AND;
            const subquery = qb.connection
                .createQueryBuilder()
                .select('asset.id')
                .from(asset_entity_1.Asset, 'asset')
                .leftJoin('asset.tags', 'tags')
                .where('tags.value IN (:...tags)');
            if (operator === generated_types_1.LogicalOperator.AND) {
                subquery.groupBy('asset.id').having('COUNT(asset.id) = :tagCount');
            }
            qb.andWhere(`asset.id IN (${subquery.getQuery()})`).setParameters({
                tags,
                tagCount: tags.length,
            });
        }
        return qb.getManyAndCount().then(([items, totalItems]) => ({
            items: items.map(asset => this.translator.translate(asset, ctx)),
            totalItems,
        }));
    }
    async getFeaturedAsset(ctx, entity) {
        const entityType = Object.getPrototypeOf(entity).constructor;
        let entityWithFeaturedAsset;
        if (this.channelService.isChannelAware(entity)) {
            entityWithFeaturedAsset = await this.connection.findOneInChannel(ctx, entityType, entity.id, ctx.channelId, {
                relations: ['featuredAsset'],
                loadEagerRelations: false,
            });
        }
        else {
            entityWithFeaturedAsset = await this.connection
                .getRepository(ctx, entityType)
                .findOne({
                where: { id: entity.id },
                relations: {
                    featuredAsset: true,
                },
                loadEagerRelations: false,
                // TODO: satisfies
            })
                .then(result => result !== null && result !== void 0 ? result : undefined);
        }
        return (entityWithFeaturedAsset && entityWithFeaturedAsset.featuredAsset) || undefined;
    }
    /**
     * @description
     * Returns the Assets of an entity which has a well-ordered list of Assets, such as Product,
     * ProductVariant or Collection.
     */
    async getEntityAssets(ctx, entity) {
        var _a, _b;
        let orderableAssets = entity.assets;
        if (!orderableAssets) {
            const entityType = Object.getPrototypeOf(entity).constructor;
            const entityWithAssets = await this.connection
                .getRepository(ctx, entityType)
                .createQueryBuilder('entity')
                .leftJoinAndSelect('entity.assets', 'orderable_asset')
                .leftJoinAndSelect('orderable_asset.asset', 'asset')
                .leftJoinAndSelect('asset.translations', 'asset_translations')
                .leftJoinAndSelect('asset.channels', 'asset_channel')
                .where('entity.id = :id', { id: entity.id })
                .andWhere('asset_channel.id = :channelId', { channelId: ctx.channelId })
                .getOne();
            orderableAssets = (_a = entityWithAssets === null || entityWithAssets === void 0 ? void 0 : entityWithAssets.assets) !== null && _a !== void 0 ? _a : [];
        }
        else if (0 < orderableAssets.length) {
            // the Assets are already loaded, but we need to limit them by Channel
            if ((_b = orderableAssets[0].asset) === null || _b === void 0 ? void 0 : _b.channels) {
                orderableAssets = orderableAssets.filter(a => !!a.asset.channels.map(c => c.id).find(id => (0, utils_1.idsAreEqual)(id, ctx.channelId)));
            }
            else {
                const assetsInChannel = await this.connection
                    .getRepository(ctx, asset_entity_1.Asset)
                    .createQueryBuilder('asset')
                    .leftJoinAndSelect('asset.channels', 'asset_channel')
                    .where('asset.id IN (:...ids)', { ids: orderableAssets.map(a => a.assetId) })
                    .andWhere('asset_channel.id = :channelId', { channelId: ctx.channelId })
                    .getMany();
                orderableAssets = orderableAssets.filter(oa => !!assetsInChannel.find(a => (0, utils_1.idsAreEqual)(a.id, oa.assetId)));
            }
        }
        else {
            orderableAssets = [];
        }
        return orderableAssets.sort((a, b) => a.position - b.position).map(a => a.asset);
    }
    async updateFeaturedAsset(ctx, entity, input) {
        const { assetIds, featuredAssetId } = input;
        if (featuredAssetId === null || (assetIds && assetIds.length === 0)) {
            entity.featuredAsset = null;
            return entity;
        }
        if (featuredAssetId === undefined) {
            return entity;
        }
        const featuredAsset = await this.findOne(ctx, featuredAssetId);
        if (featuredAsset) {
            entity.featuredAsset = featuredAsset;
        }
        return entity;
    }
    /**
     * @description
     * Updates the assets / featuredAsset of an entity, ensuring that only valid assetIds are used.
     */
    async updateEntityAssets(ctx, entity, input) {
        if (!entity.id) {
            throw new errors_1.InternalServerError('error.entity-must-have-an-id');
        }
        const { assetIds } = input;
        if (assetIds && assetIds.length) {
            const assets = await this.connection.findByIdsInChannel(ctx, asset_entity_1.Asset, assetIds, ctx.channelId, {});
            const sortedAssets = assetIds
                .map(id => assets.find(a => (0, utils_1.idsAreEqual)(a.id, id)))
                .filter(shared_utils_1.notNullOrUndefined);
            await this.removeExistingOrderableAssets(ctx, entity);
            if (sortedAssets.length > 0) {
                entity.assets = await this.createOrderableAssets(ctx, entity, sortedAssets);
            }
            else {
                entity.assets = [];
            }
        }
        else if (assetIds && assetIds.length === 0) {
            await this.removeExistingOrderableAssets(ctx, entity);
        }
        return entity;
    }
    /**
     * @description
     * Create an Asset based on a file uploaded via the GraphQL API. The file should be uploaded
     * using the [GraphQL multipart request specification](https://github.com/jaydenseric/graphql-multipart-request-spec),
     * e.g. using the [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client) npm package.
     *
     * See the [Uploading Files docs](/developer-guide/uploading-files) for an example of usage.
     */
    async create(ctx, input) {
        const { createReadStream, filename, mimetype } = await input.file;
        const { stream, errorPromise } = this.makeStreamGuard(createReadStream);
        const result = await Promise.race([
            this.createAssetInternal(ctx, stream, filename, mimetype, input.customFields, input.translations),
            errorPromise,
        ]);
        if ((0, error_result_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        await this.customFieldRelationService.updateRelations(ctx, asset_entity_1.Asset, input, result);
        if (input.tags) {
            const tags = await this.tagService.valuesToTags(ctx, input.tags);
            result.tags = tags;
            await this.connection.getRepository(ctx, asset_entity_1.Asset).save(result);
        }
        const translatedAsset = this.translator.translate(result, ctx);
        await this.eventBus.publish(new asset_event_1.AssetEvent(ctx, translatedAsset, 'created', input));
        return translatedAsset;
    }
    /**
     * @description
     * Updates the name, focalPoint, tags & custom fields of an Asset.
     */
    async update(ctx, input) {
        var _a;
        const asset = await this.connection.getEntityOrThrow(ctx, asset_entity_1.Asset, input.id);
        if (input.focalPoint) {
            const to3dp = (x) => +x.toFixed(3);
            input.focalPoint.x = to3dp(input.focalPoint.x);
            input.focalPoint.y = to3dp(input.focalPoint.y);
        }
        (0, patch_entity_1.patchEntity)(asset, (0, omit_1.omit)(input, ['tags', 'name', 'translations']));
        if (input.tags) {
            asset.tags = await this.tagService.valuesToTags(ctx, input.tags);
        }
        // Handle translations
        const translationsInput = (_a = input.translations) !== null && _a !== void 0 ? _a : [];
        // For backward compatibility: if name is provided without translations, update the current language translation
        if (input.name != null && !translationsInput.some(t => t.languageCode === ctx.languageCode)) {
            translationsInput.push({ languageCode: ctx.languageCode, name: input.name });
        }
        // Save asset first to ensure it exists for translation foreign key, and so that
        // updateRelations() sees the freshly-patched scalar custom fields when it reloads
        // the entity from the DB.
        const savedAsset = await this.connection.getRepository(ctx, asset_entity_1.Asset).save(asset);
        await this.customFieldRelationService.updateRelations(ctx, asset_entity_1.Asset, input, asset);
        if (translationsInput.length > 0) {
            await this.translatableSaver.update({
                ctx,
                input: { id: savedAsset.id, translations: translationsInput },
                entityType: asset_entity_1.Asset,
                translationType: asset_translation_entity_1.AssetTranslation,
            });
        }
        const translatedAsset = await this.findOne(ctx, savedAsset.id);
        if (!translatedAsset) {
            throw new errors_1.InternalServerError('error.entity-not-found');
        }
        await this.eventBus.publish(new asset_event_1.AssetEvent(ctx, translatedAsset, 'updated', input));
        return translatedAsset;
    }
    /**
     * @description
     * Deletes an Asset after performing checks to ensure that the Asset is not currently in use
     * by a Product, ProductVariant or Collection.
     */
    async delete(ctx, ids, force = false, deleteFromAllChannels = false) {
        const assets = await this.connection.findByIdsInChannel(ctx, asset_entity_1.Asset, ids, ctx.channelId, {
            relations: ['channels'],
        });
        let channelsOfAssets = [];
        assets.forEach(a => a.channels.forEach(c => channelsOfAssets.push(c.id)));
        channelsOfAssets = (0, unique_1.unique)(channelsOfAssets);
        const usageCount = {
            products: 0,
            variants: 0,
            collections: 0,
        };
        for (const asset of assets) {
            const usages = await this.findAssetUsages(ctx, asset);
            usageCount.products += usages.products.length;
            usageCount.variants += usages.variants.length;
            usageCount.collections += usages.collections.length;
        }
        const hasUsages = !!(usageCount.products || usageCount.variants || usageCount.collections);
        if (hasUsages && !force) {
            return {
                result: generated_types_1.DeletionResult.NOT_DELETED,
                message: ctx.translate('message.asset-to-be-deleted-is-featured', {
                    assetCount: assets.length,
                    products: usageCount.products,
                    variants: usageCount.variants,
                    collections: usageCount.collections,
                }),
            };
        }
        const hasDeleteAllPermission = await this.hasDeletePermissionForChannels(ctx, channelsOfAssets);
        if (deleteFromAllChannels && !hasDeleteAllPermission) {
            throw new errors_1.ForbiddenError();
        }
        if (!deleteFromAllChannels) {
            await Promise.all(assets.map(async (asset) => {
                await this.channelService.removeFromChannels(ctx, asset_entity_1.Asset, asset.id, [ctx.channelId]);
                await this.eventBus.publish(new asset_channel_event_1.AssetChannelEvent(ctx, asset, ctx.channelId, 'removed'));
            }));
            const isOnlyChannel = channelsOfAssets.length === 1;
            if (isOnlyChannel) {
                // only channel, so also delete asset
                await this.deleteUnconditional(ctx, assets);
            }
            return {
                result: generated_types_1.DeletionResult.DELETED,
            };
        }
        // This leaves us with deleteFromAllChannels with force or deleteFromAllChannels with no current usages
        await Promise.all(assets.map(async (asset) => {
            await this.channelService.removeFromChannels(ctx, asset_entity_1.Asset, asset.id, channelsOfAssets);
            await this.eventBus.publish(new asset_channel_event_1.AssetChannelEvent(ctx, asset, ctx.channelId, 'removed'));
        }));
        return this.deleteUnconditional(ctx, assets);
    }
    async assignToChannel(ctx, input) {
        const hasPermission = await this.roleService.userHasPermissionOnChannel(ctx, input.channelId, generated_types_1.Permission.UpdateCatalog);
        if (!hasPermission) {
            throw new errors_1.ForbiddenError();
        }
        const assets = await this.connection.findByIdsInChannel(ctx, asset_entity_1.Asset, input.assetIds, ctx.channelId, {});
        await Promise.all(assets.map(async (asset) => {
            await this.channelService.assignToChannels(ctx, asset_entity_1.Asset, asset.id, [input.channelId]);
            return await this.eventBus.publish(new asset_channel_event_1.AssetChannelEvent(ctx, asset, input.channelId, 'assigned'));
        }));
        const updatedAssets = await this.connection.findByIdsInChannel(ctx, asset_entity_1.Asset, assets.map(a => a.id), ctx.channelId, {});
        return updatedAssets.map(asset => this.translator.translate(asset, ctx));
    }
    async createFromFileStream(stream, maybeFilePathOrCtx, maybeCtx) {
        const { assetImportStrategy } = this.configService.importExportOptions;
        const filePathFromArgs = maybeFilePathOrCtx instanceof request_context_1.RequestContext ? undefined : maybeFilePathOrCtx;
        const filePath = stream instanceof fs_extra_1.ReadStream || stream instanceof fs_1.ReadStream ? stream.path : filePathFromArgs;
        if (typeof filePath === 'string') {
            const filename = path_1.default.basename(filePath).split('?')[0];
            const mimetype = this.getMimeType(stream, filename);
            const ctx = maybeFilePathOrCtx instanceof request_context_1.RequestContext
                ? maybeFilePathOrCtx
                : maybeCtx instanceof request_context_1.RequestContext
                    ? maybeCtx
                    : request_context_1.RequestContext.empty();
            const result = await this.createAssetInternal(ctx, stream, filename, mimetype);
            if ((0, error_result_1.isGraphQlErrorResult)(result)) {
                return result;
            }
            return this.translator.translate(result, ctx);
        }
        else {
            throw new errors_1.InternalServerError('error.path-should-be-a-string-got-buffer');
        }
    }
    getMimeType(stream, filename) {
        if (stream instanceof http_1.IncomingMessage) {
            const contentType = stream.headers['content-type'];
            if (contentType) {
                return contentType;
            }
        }
        return mime_types_1.default.lookup(filename) || 'application/octet-stream';
    }
    /**
     * @description
     * Unconditionally delete given assets.
     * Does not remove assets from channels
     */
    async deleteUnconditional(ctx, assets) {
        for (const asset of assets) {
            // Create a new asset so that the id is still available
            // after deletion (the .remove() method sets it to undefined)
            const deletedAsset = new asset_entity_1.Asset(asset);
            await this.connection.getRepository(ctx, asset_entity_1.Asset).remove(asset);
            try {
                await this.configService.assetOptions.assetStorageStrategy.deleteFile(asset.source);
                await this.configService.assetOptions.assetStorageStrategy.deleteFile(asset.preview);
            }
            catch (e) {
                vendure_logger_1.Logger.error('error.could-not-delete-asset-file', undefined, e.stack);
            }
            await this.eventBus.publish(new asset_event_1.AssetEvent(ctx, deletedAsset, 'deleted', deletedAsset.id));
        }
        return {
            result: generated_types_1.DeletionResult.DELETED,
        };
    }
    /**
     * Check if current user has permissions to delete assets from all channels
     */
    async hasDeletePermissionForChannels(ctx, channelIds) {
        const permissions = await Promise.all(channelIds.map(async (channelId) => {
            return this.roleService.userHasPermissionOnChannel(ctx, channelId, generated_types_1.Permission.DeleteCatalog);
        }));
        return !permissions.includes(false);
    }
    async createAssetInternal(ctx, stream, filename, mimetype, customFields, translations) {
        const { assetOptions } = this.configService;
        if (!this.validateMimeType(mimetype)) {
            return new generated_graphql_admin_errors_1.MimeTypeError({ fileName: filename, mimeType: mimetype });
        }
        const { assetPreviewStrategy, assetStorageStrategy } = assetOptions;
        const sourceFileName = await this.getSourceFileName(ctx, filename);
        const previewFileName = await this.getPreviewFileName(ctx, sourceFileName);
        const sourceFileIdentifier = await assetStorageStrategy.writeFileFromStream(sourceFileName, stream);
        const sourceFile = await assetStorageStrategy.readFileToBuffer(sourceFileIdentifier);
        let preview;
        try {
            preview = await assetPreviewStrategy.generatePreviewImage(ctx, mimetype, sourceFile);
        }
        catch (e) {
            const message = typeof e.message === 'string' ? e.message : e.message.toString();
            vendure_logger_1.Logger.error(`Could not create Asset preview image: ${message}`, undefined, e.stack);
            throw e;
        }
        const previewFileIdentifier = await assetStorageStrategy.writeFileFromBuffer(previewFileName, preview);
        const type = (0, utils_1.getAssetType)(mimetype);
        const { width, height } = this.getDimensions(type === generated_types_1.AssetType.IMAGE ? sourceFile : preview);
        // Save asset first
        const asset = new asset_entity_1.Asset({
            type,
            width,
            height,
            fileSize: sourceFile.byteLength,
            mimeType: mimetype,
            source: sourceFileIdentifier,
            preview: previewFileIdentifier,
            focalPoint: null,
            customFields,
        });
        await this.channelService.assignToCurrentChannel(asset, ctx);
        const savedAsset = await this.connection.getRepository(ctx, asset_entity_1.Asset).save(asset);
        // Create and save translations with the base relationship set
        // Use the original filename for the default translation name
        const defaultName = filename;
        let assetTranslations;
        if (translations && translations.length > 0) {
            assetTranslations = translations.map(t => {
                var _a;
                return new asset_translation_entity_1.AssetTranslation({
                    languageCode: t.languageCode,
                    name: (_a = t.name) !== null && _a !== void 0 ? _a : defaultName,
                    customFields: t.customFields,
                    base: savedAsset,
                });
            });
        }
        else {
            // Create default translation using context language
            assetTranslations = [
                new asset_translation_entity_1.AssetTranslation({
                    languageCode: ctx.languageCode,
                    name: defaultName,
                    base: savedAsset,
                }),
            ];
        }
        // Save translations
        const savedTranslations = await this.connection
            .getRepository(ctx, asset_translation_entity_1.AssetTranslation)
            .save(assetTranslations);
        // Return the asset with translations eagerly loaded
        savedAsset.translations = savedTranslations;
        return savedAsset;
    }
    async getSourceFileName(ctx, fileName) {
        const { assetOptions } = this.configService;
        return this.generateUniqueName(fileName, (name, conflict) => assetOptions.assetNamingStrategy.generateSourceFileName(ctx, name, conflict));
    }
    async getPreviewFileName(ctx, fileName) {
        const { assetOptions } = this.configService;
        return this.generateUniqueName(fileName, (name, conflict) => assetOptions.assetNamingStrategy.generatePreviewFileName(ctx, name, conflict));
    }
    async generateUniqueName(inputFileName, generateNameFn) {
        const { assetOptions } = this.configService;
        let outputFileName;
        do {
            outputFileName = generateNameFn(inputFileName, outputFileName);
        } while (await assetOptions.assetStorageStrategy.fileExists(outputFileName));
        return outputFileName;
    }
    getDimensions(imageFile) {
        try {
            const { width, height } = (0, image_size_1.imageSize)(imageFile);
            return { width: width !== null && width !== void 0 ? width : 0, height: height !== null && height !== void 0 ? height : 0 };
        }
        catch (e) {
            vendure_logger_1.Logger.error('Could not determine Asset dimensions: ' + JSON.stringify(e));
            return { width: 0, height: 0 };
        }
    }
    createOrderableAssets(ctx, entity, assets) {
        const orderableAssets = assets.map((asset, i) => this.getOrderableAsset(ctx, entity, asset, i));
        return this.connection.getRepository(ctx, orderableAssets[0].constructor).save(orderableAssets);
    }
    getOrderableAsset(ctx, entity, asset, index) {
        const entityIdProperty = this.getHostEntityIdProperty(entity);
        const orderableAssetType = this.getOrderableAssetType(ctx, entity);
        return new orderableAssetType({
            assetId: asset.id,
            position: index,
            [entityIdProperty]: entity.id,
        });
    }
    async removeExistingOrderableAssets(ctx, entity) {
        const propertyName = this.getHostEntityIdProperty(entity);
        const orderableAssetType = this.getOrderableAssetType(ctx, entity);
        await this.connection.getRepository(ctx, orderableAssetType).delete({
            [propertyName]: entity.id,
        });
    }
    getOrderableAssetType(ctx, entity) {
        const assetRelation = this.connection
            .getRepository(ctx, entity.constructor)
            .metadata.relations.find(r => r.propertyName === 'assets');
        if (!assetRelation || typeof assetRelation.type === 'string') {
            throw new errors_1.InternalServerError('error.could-not-find-matching-orderable-asset');
        }
        return assetRelation.type;
    }
    getHostEntityIdProperty(entity) {
        const entityName = entity.constructor.name;
        switch (entityName) {
            case 'Product':
                return 'productId';
            case 'ProductVariant':
                return 'productVariantId';
            case 'Collection':
                return 'collectionId';
            default:
                return `${(0, StringUtils_1.camelCase)(entityName)}Id`;
        }
    }
    validateMimeType(mimeType) {
        const [type, subtype] = mimeType.split('/');
        const typeMatches = this.permittedMimeTypes.filter(t => t.type === type);
        for (const match of typeMatches) {
            if (match.subtype === subtype || match.subtype === '*') {
                return true;
            }
        }
        return false;
    }
    /**
     * Find the entities which reference the given Asset as a featuredAsset.
     */
    async findAssetUsages(ctx, asset) {
        const products = await this.connection.getRepository(ctx, product_entity_1.Product).find({
            where: {
                featuredAsset: { id: asset.id },
                deletedAt: (0, typeorm_1.IsNull)(),
            },
        });
        const variants = await this.connection.getRepository(ctx, product_variant_entity_1.ProductVariant).find({
            where: {
                featuredAsset: { id: asset.id },
                deletedAt: (0, typeorm_1.IsNull)(),
            },
        });
        const collections = await this.connection.getRepository(ctx, collection_entity_1.Collection).find({
            where: {
                featuredAsset: { id: asset.id },
            },
        });
        return { products, variants, collections };
    }
    makeStreamGuard(createReadStream) {
        let onReject;
        const errorPromise = new Promise((_, rej) => {
            onReject = rej;
        });
        // `fs-capacitor`'s `createReadStream` can throw if its `WriteStream` has already been destroyed
        // sync error so will bubble to consumer immediately
        const stream = createReadStream();
        stream.on('error', err => {
            onReject(err);
        });
        return { stream, errorPromise };
    }
};
exports.AssetService = AssetService;
exports.AssetService = AssetService = __decorate([
    (0, common_1.Injectable)(),
    (0, common_2.Instrument)(),
    __metadata("design:paramtypes", [transactional_connection_1.TransactionalConnection,
        config_service_1.ConfigService,
        list_query_builder_1.ListQueryBuilder,
        event_bus_1.EventBus,
        tag_service_1.TagService,
        channel_service_1.ChannelService,
        role_service_1.RoleService,
        custom_field_relation_service_1.CustomFieldRelationService,
        translatable_saver_1.TranslatableSaver,
        translator_service_1.TranslatorService])
], AssetService);
//# sourceMappingURL=asset.service.js.map