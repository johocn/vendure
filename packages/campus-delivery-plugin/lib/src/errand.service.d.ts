import { ModuleRef } from '@nestjs/core';
import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
/** 0 元载体商品 SKU：幂等创建的查重键，C 端 addItemToOrder 用其 variantId 加购物车 */
export declare const ERRAND_BASE_SKU = "CAMPUS-ERRAND-BASE";
export declare const ERRAND_BASE_SLUG = "campus-errand-base";
/**
 * R5 跑腿单：两步式链路——
 * 1) admin 用 ensureErrandProduct 幂等建 0 元载体（SKU 查重入口）；
 * 2) C 端先 addItemToOrder(variantId)，再 campusSetErrandInfo 写 errand 标记 + 小费 surcharge。
 * 支付金额 = 商品(0) + shipping(campusErrandCalculator 按 zone.fee) + surcharge(tip)；
 * 分成按 shipping + tip 计算（surcharge 不进 order.shipping，无双算）。
 */
export declare class ErrandService {
    private connection;
    private orderService;
    private moduleRef;
    constructor(connection: TransactionalConnection, orderService: OrderService, moduleRef: ModuleRef);
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector();
    /** 幂等创建 0 元载体：按 SKU 查 ProductVariant，已存在直接返回。
     * ProductVariant 有 product FK，必须走 ProductService/ProductVariantService 组合（禁裸 repo.save 单表）。 */
    ensureErrandProduct(ctx: RequestContext): Promise<{
        variantId: ID;
        sku: string;
        created: boolean;
    }>;
    /**
     * C 端跑腿单第二步：写 errand customFields（标记 orderKind/R5 + 起止 + 小费），
     * tip>0 时给订单加小费 surcharge（listPrice=tip，含税口径）。
     */
    setErrandInfo(ctx: RequestContext, input: {
        kind: string;
        fromText: string;
        toText: string;
        tip: number;
        buildingId?: string;
        campusZone?: string;
    }): Promise<import("@vendure/core").Order>;
}
