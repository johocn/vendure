import { Product, ProductService, RequestContext, TransactionalConnection } from '@vendure/core';
export interface MarketplaceProductView {
    id: string;
    name: string;
    listedInMarketplace: boolean;
    marketplaceStatus: string | null;
    merchantRef: string | null;
    rejectReason: string | null;
}
export declare class MarketplaceProductService {
    private productService;
    private connection;
    constructor(productService: ProductService, connection: TransactionalConnection);
    /** 提审：marketplaceStatus → pending */
    submitToMarketplace(ctx: RequestContext, productId: string): Promise<Product>;
    /** 审核：approve=true → approved+listed；approve=false → rejected+reason */
    review(ctx: RequestContext, productId: string, approve: boolean, rejectReason?: string | null): Promise<Product>;
    /** 跨租户按状态查询（含审批信息的精简视图）。status 为空查全部（含未提审），保证平台可对未提审商品发起「提审」。 */
    findByStatus(ctx: RequestContext, status?: string | null): Promise<MarketplaceProductView[]>;
    /** 按 id 精确取单个审批视图（提审/审核后回显用） */
    findOneView(ctx: RequestContext, productId: string): Promise<MarketplaceProductView>;
    private toView;
}
