import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    EntityHydrator,
    ID,
    idsAreEqual,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import {
    MARKETPLACE_STATUS_APPROVED,
    MARKETPLACE_STATUS_PENDING,
    MARKETPLACE_STATUS_REJECTED,
} from './constants';

export interface MarketplaceProductsOptions {
    take?: number;
    skip?: number;
}

@Injectable()
export class MarketplaceService {
    constructor(
        private connection: TransactionalConnection,
        private entityHydrator: EntityHydrator,
        private channelService: ChannelService,
    ) {}

    /** 校验条形码在平台内唯一（跨所有 Channel）。返回所属 ProductId 与首个 VariantId；空则无冲突。 */
    async findBarcodeOwner(barcode: string): Promise<{ productId: ID; variantId: ID } | null> {
        if (!barcode) return null;
        const repo = this.connection.rawConnection.getRepository(Product);
        const product = await repo.findOne({
            where: { customFields: { barcode } as any },
            relations: ['variants'],
        });
        if (!product || !product.variants || product.variants.length === 0) {
            return null;
        }
        return { productId: product.id, variantId: product.variants[0].id };
    }

    /** 保存前校验：若 barcode 已被其他商品占用则抛错 */
    async assertBarcodeUnique(barcode: string, excludeProductId?: ID): Promise<void> {
        const owner = await this.findBarcodeOwner(barcode);
        if (owner && (!excludeProductId || owner.productId !== excludeProductId)) {
            throw new UserInputError(`条形码 ${barcode} 已被占用`);
        }
    }

    async getProductOrThrow(ctx: RequestContext, productId: ID): Promise<Product> {
        const product = await this.connection.getRepository(ctx, Product).findOne({
            where: { id: productId as any },
        });
        if (!product) {
            throw new UserInputError('商品不存在');
        }
        return product;
    }

    /** 商家提交商品上架 marketplace（置审批中，不对外展示） */
    async submitForMarketplace(ctx: RequestContext, productId: ID): Promise<void> {
        const product = await this.getProductOrThrow(ctx, productId);
        if (product.customFields.barcode) {
            await this.assertBarcodeUnique(product.customFields.barcode, productId);
        }
        product.customFields.listedInMarketplace = false;
        product.customFields.marketplaceStatus = MARKETPLACE_STATUS_PENDING;
        product.customFields.rejectReason = undefined;
        await this.connection.getRepository(ctx, Product).save(product);
    }

    /** 平台运营/超管审批通过：对外展示 */
    async approveMarketplaceProduct(ctx: RequestContext, productId: ID): Promise<void> {
        const product = await this.getProductOrThrow(ctx, productId);
        // 商家商品归属于 default + 商家渠道：merchantRef 指向非默认渠道（与分单策略一致）。
        // 仅属于 default 的自营商品则 merchantRef 保持 null。
        await this.entityHydrator.hydrate(ctx, product, { relations: ['channels'] } as any);
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const nonDefaultChannel = product.channels?.find(c => !idsAreEqual(c.id, defaultChannel.id));
        product.customFields.merchantRef = nonDefaultChannel ? (nonDefaultChannel.id as any) : null;
        product.customFields.marketplaceStatus = MARKETPLACE_STATUS_APPROVED;
        product.customFields.listedInMarketplace = true;
        product.customFields.rejectReason = undefined;
        await this.connection.getRepository(ctx, Product).save(product);
    }

    /** 平台运营/超管驳回：不展示，记录原因 */
    async rejectMarketplaceProduct(ctx: RequestContext, productId: ID, reason: string): Promise<void> {
        const product = await this.getProductOrThrow(ctx, productId);
        product.customFields.marketplaceStatus = MARKETPLACE_STATUS_REJECTED;
        product.customFields.listedInMarketplace = false;
        product.customFields.rejectReason = reason;
        await this.connection.getRepository(ctx, Product).save(product);
    }

    /** 待审批商品列表 */
    async getPendingProducts(ctx: RequestContext): Promise<Product[]> {
        return this.connection.getRepository(ctx, Product).find({
            where: { customFields: { marketplaceStatus: MARKETPLACE_STATUS_PENDING } as any },
        });
    }

    /**
     * 聚合 marketplace 对外展示的商品（自营 + 各商家）。
     * 仅返回 marketplaceStatus='approved' 且 listedInMarketplace=true 的商品，
     * 并 hydrate 商家渠道（merchantRef）与商品主图（featuredAsset），供前端按商家分组展示。
     * relation custom field 存储于独立 junction 表，故用 EntityHydrator 加载最稳妥。
     */
    async getMarketplaceProducts(
        ctx: RequestContext,
        options?: MarketplaceProductsOptions,
    ): Promise<Product[]> {
        const products = await this.connection.getRepository(ctx, Product).find({
            where: {
                customFields: {
                    marketplaceStatus: MARKETPLACE_STATUS_APPROVED,
                    listedInMarketplace: true,
                } as any,
            },
            take: options?.take,
            skip: options?.skip,
        });
        for (const product of products) {
            await this.entityHydrator.hydrate(ctx, product, {
                relations: ['customFields.merchantRef', 'featuredAsset'],
            });
        }
        return products;
    }
}