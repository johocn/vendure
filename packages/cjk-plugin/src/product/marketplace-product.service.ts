import { Injectable } from '@nestjs/common';
import { Product, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';

export interface MarketplaceProductView {
    id: string;
    name: string;
    listedInMarketplace: boolean;
    marketplaceStatus: string | null;
    merchantRef: string | null;
    rejectReason: string | null;
}

@Injectable()
export class MarketplaceProductService {
    constructor(
        private productService: ProductService,
        private connection: TransactionalConnection,
    ) {}

    /** 提审：marketplaceStatus → pending */
    async submitToMarketplace(ctx: RequestContext, productId: string): Promise<Product> {
        const product = await this.productService.findOne(ctx, productId as any, ['featuredAsset']);
        if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        }
        const status = (product.customFields as any)?.marketplaceStatus as string | undefined;
        if (status === 'approved') {
            throw new Error('PRODUCT_ALREADY_APPROVED');
        }
        return this.productService.update(ctx, {
            id: productId,
            customFields: {
                listedInMarketplace: false,
                marketplaceStatus: 'pending',
            },
        } as any);
    }

    /** 审核：approve=true → approved+listed；approve=false → rejected+reason */
    async review(ctx: RequestContext, productId: string, approve: boolean, rejectReason?: string | null): Promise<Product> {
        const product = await this.productService.findOne(ctx, productId as any);
        if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        }
        if (approve) {
            return this.productService.update(ctx, {
                id: productId,
                customFields: {
                    listedInMarketplace: true,
                    marketplaceStatus: 'approved',
                    rejectReason: null,
                },
            } as any);
        }
        return this.productService.update(ctx, {
            id: productId,
            customFields: {
                listedInMarketplace: false,
                marketplaceStatus: 'rejected',
                rejectReason: rejectReason ?? null,
            },
        } as any);
    }

    /** 跨租户按状态查询（含审批信息的精简视图）。status 为空查全部（含未提审），保证平台可对未提审商品发起「提审」。 */
    async findByStatus(ctx: RequestContext, status?: string | null): Promise<MarketplaceProductView[]> {
        const qb = this.connection
            .getRepository(ctx, Product)
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.translations', 'translations')
            .leftJoinAndSelect('product.featuredAsset', 'featuredAsset')
            .take(500);
        if (status) {
            qb.andWhere('product.customFieldsMarketplacestatus = :s', { s: status });
        }
        const rows = (await qb.getMany()) as any[];
        return rows.map((r: any) => this.toView(ctx, r));
    }

    /** 按 id 精确取单个审批视图（提审/审核后回显用） */
    async findOneView(ctx: RequestContext, productId: string): Promise<MarketplaceProductView> {
        const product = await this.productService.findOne(ctx, productId as any, ['featuredAsset', 'translations']);
        if (!product) throw new Error(`PRODUCT_NOT_FOUND: ${productId}`);
        return this.toView(ctx, product as any);
    }

    private toView(ctx: RequestContext, r: any): MarketplaceProductView {
        return {
            id: r.id,
            name: r.translations?.find((t: any) => t.languageCode === ctx.languageCode || t.languageCode === 'zh_Hans')?.name ?? r.id,
            listedInMarketplace: !!r.customFields?.listedInMarketplace,
            marketplaceStatus: r.customFields?.marketplaceStatus ?? null,
            merchantRef: r.customFields?.merchantRef ?? null,
            rejectReason: r.customFields?.rejectReason ?? null,
        };
    }
}