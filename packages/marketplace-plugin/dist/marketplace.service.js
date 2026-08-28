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
const constants_1 = require("./constants");
let MarketplaceService = class MarketplaceService {
    constructor(connection, entityHydrator, channelService) {
        this.connection = connection;
        this.entityHydrator = entityHydrator;
        this.channelService = channelService;
    }
    /** 校验条形码在平台内唯一（跨所有 Channel）。返回所属 ProductId 与首个 VariantId；空则无冲突。 */
    async findBarcodeOwner(barcode) {
        if (!barcode)
            return null;
        const repo = this.connection.rawConnection.getRepository(core_1.Product);
        const product = await repo.findOne({
            where: { customFields: { barcode } },
            relations: ['variants'],
        });
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
    async getProductOrThrow(ctx, productId) {
        const product = await this.connection.getRepository(ctx, core_1.Product).findOne({
            where: { id: productId },
        });
        if (!product) {
            throw new core_1.UserInputError('商品不存在');
        }
        return product;
    }
    /** 校验商品归属指定渠道后可提交上架（供 admin API，防止商户提审他人商品） */
    async submitForMarketplaceOwnedByChannel(ctx, productId, channelId) {
        const product = await this.getProductOrThrow(ctx, productId);
        await this.entityHydrator.hydrate(ctx, product, { relations: ['channels'] });
        const owned = (product.channels || []).some(c => (0, core_1.idsAreEqual)(c.id, channelId));
        if (!owned && channelId != null) {
            throw new core_1.UserInputError('只能对当前店铺的商品提交上架');
        }
        await this.submitForMarketplace(ctx, productId);
    }
    /** 商家提交商品上架 marketplace（置审批中，不对外展示） */
    async submitForMarketplace(ctx, productId) {
        const product = await this.getProductOrThrow(ctx, productId);
        if (product.customFields.barcode) {
            await this.assertBarcodeUnique(product.customFields.barcode, productId);
        }
        product.customFields.listedInMarketplace = false;
        product.customFields.marketplaceStatus = constants_1.MARKETPLACE_STATUS_PENDING;
        product.customFields.rejectReason = undefined;
        await this.connection.getRepository(ctx, core_1.Product).save(product);
    }
    /** 平台运营/超管审批通过：对外展示 */
    async approveMarketplaceProduct(ctx, productId) {
        var _a;
        const product = await this.getProductOrThrow(ctx, productId);
        // 商家商品归属于 default + 商家渠道：merchantRef 指向非默认渠道（与分单策略一致）。
        // 仅属于 default 的自营商品则 merchantRef 保持 null。
        await this.entityHydrator.hydrate(ctx, product, { relations: ['channels'] });
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const nonDefaultChannel = (_a = product.channels) === null || _a === void 0 ? void 0 : _a.find(c => !(0, core_1.idsAreEqual)(c.id, defaultChannel.id));
        product.customFields.merchantRef = nonDefaultChannel ? nonDefaultChannel.id : null;
        product.customFields.marketplaceStatus = constants_1.MARKETPLACE_STATUS_APPROVED;
        product.customFields.listedInMarketplace = true;
        product.customFields.rejectReason = undefined;
        await this.connection.getRepository(ctx, core_1.Product).save(product);
    }
    /** 平台运营/超管驳回：不展示，记录原因 */
    async rejectMarketplaceProduct(ctx, productId, reason) {
        const product = await this.getProductOrThrow(ctx, productId);
        product.customFields.marketplaceStatus = constants_1.MARKETPLACE_STATUS_REJECTED;
        product.customFields.listedInMarketplace = false;
        product.customFields.rejectReason = reason;
        await this.connection.getRepository(ctx, core_1.Product).save(product);
    }
    /** 待审批商品列表 */
    async getPendingProducts(ctx) {
        return this.connection.getRepository(ctx, core_1.Product).find({
            where: { customFields: { marketplaceStatus: constants_1.MARKETPLACE_STATUS_PENDING } },
        });
    }
    /**
     * 聚合 marketplace 对外展示的商品（自营 + 各商家）。
     * 仅返回 marketplaceStatus='approved' 且 listedInMarketplace=true 的商品，
     * 并 hydrate 商家渠道（merchantRef）与商品主图（featuredAsset），供前端按商家分组展示。
     * relation custom field 存储于独立 junction 表，故用 EntityHydrator 加载最稳妥。
     */
    async getMarketplaceProducts(ctx, options) {
        const products = await this.connection.getRepository(ctx, core_1.Product).find({
            where: {
                customFields: {
                    marketplaceStatus: constants_1.MARKETPLACE_STATUS_APPROVED,
                    listedInMarketplace: true,
                },
            },
            take: options === null || options === void 0 ? void 0 : options.take,
            skip: options === null || options === void 0 ? void 0 : options.skip,
        });
        for (const product of products) {
            await this.entityHydrator.hydrate(ctx, product, {
                relations: ['customFields.merchantRef.seller', 'featuredAsset'],
            });
        }
        return products;
    }
};
exports.MarketplaceService = MarketplaceService;
exports.MarketplaceService = MarketplaceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.EntityHydrator,
        core_1.ChannelService])
], MarketplaceService);
