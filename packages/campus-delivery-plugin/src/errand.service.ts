import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ForbiddenError,
    ID,
    Injector,
    Order,
    OrderService,
    Product,
    ProductService,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';

/** 0 元载体商品 SKU：幂等创建的查重键，C 端 addItemToOrder 用其 variantId 加购物车 */
export const ERRAND_BASE_SKU = 'CAMPUS-ERRAND-BASE';
export const ERRAND_BASE_SLUG = 'campus-errand-base';
/** 小费 surcharge 标识（幂等清理键：同单重复设置按此描述清旧补新，防重复计费） */
export const ERRAND_TIP_SURCHARGE_DESC = '跑腿小费';

/**
 * R5 跑腿单：两步式链路——
 * 1) admin 用 ensureErrandProduct 幂等建 0 元载体（SKU 查重入口）；
 * 2) C 端先 addItemToOrder(variantId)，再 campusSetErrandInfo 写 errand 标记 + 小费 surcharge。
 * 支付金额 = 商品(0) + shipping(campusErrandCalculator 按 zone.fee) + surcharge(tip)；
 * 分成按 shipping + tip 计算（surcharge 不进 order.shipping，无双算）。
 */
@Injectable()
export class ErrandService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private moduleRef: ModuleRef,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    /** 幂等创建 0 元载体：按 SKU 查 ProductVariant，已存在直接返回。
     * ProductVariant 有 product FK，必须走 ProductService/ProductVariantService 组合（禁裸 repo.save 单表）。 */
    async ensureErrandProduct(ctx: RequestContext): Promise<{ variantId: ID; sku: string; created: boolean }> {
        const existing = await this.connection
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { sku: ERRAND_BASE_SKU } });
        if (existing) {
            return { variantId: existing.id, sku: ERRAND_BASE_SKU, created: false };
        }
        const productService = this.injector.get(ProductService);
        const variantService = this.injector.get(ProductVariantService);
        const product: Product = await productService.create(ctx, {
            translations: [{
                languageCode: ctx.languageCode, name: '校园跑腿服务',
                slug: ERRAND_BASE_SLUG, description: '跑腿单 0 元载体商品',
            }],
        } as any);
        const [variant] = await variantService.create(ctx, [
            {
                productId: product.id,
                sku: ERRAND_BASE_SKU,
                price: 0,
                translations: [{ languageCode: ctx.languageCode, name: '校园跑腿服务' }],
            },
        ] as any);
        return { variantId: variant.id, sku: ERRAND_BASE_SKU, created: true };
    }

    /**
     * C 端跑腿单第二步：写 errand customFields（标记 orderKind/R5 + 起止 + 小费），
     * tip>0 时给订单加小费 surcharge（listPrice=tip，含税口径）。
     */
    async setErrandInfo(
        ctx: RequestContext,
        input: { kind: string; fromText: string; toText: string; tip: number;
                 errandFrom?: string; note?: string; buildingId?: string; campusZone?: string },
    ) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const orderId = ctx.session?.activeOrderId;
        if (!orderId) throw new UserInputError('购物车为空');
        if (!Number.isFinite(input.tip) || input.tip < 0) throw new UserInputError('小费金额不合法');
        const tip = Math.floor(input.tip);
        const order = await this.orderService.updateCustomFields(ctx, orderId, {
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: input.kind,
            // R2 接力单：errandFrom 存原单号（campusR2Relay 反查键）；普通 R5 缺省落 A 点文字
            errandFrom: input.errandFrom ?? input.fromText,
            errandTo: input.toText,
            errandNote: input.note ?? null,
            tip,
            buildingId: input.buildingId ?? null,
            campusZone: input.campusZone ?? null,
        } as any);
        // 小费 surcharge 幂等：先清本单全部旧小费，再按新 tip 加一条（tip=0 只清不加），
        // 防止同单重复设置（改小费/改地址/重复提交）叠加多条 surcharge 重复计费
        const existing = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['surcharges'],
        });
        for (const s of (existing?.surcharges ?? []).filter(x => x.description === ERRAND_TIP_SURCHARGE_DESC)) {
            await this.orderService.removeSurchargeFromOrder(ctx, orderId as any, s.id as any);
        }
        if (tip > 0) {
            // 本 fork 无独立 SurchargeService，surcharge 原语在 OrderService.addSurchargeToOrder（service 层无权限校验，shop ctx 可用）
            await this.orderService.addSurchargeToOrder(ctx, orderId as any, {
                description: ERRAND_TIP_SURCHARGE_DESC,
                listPrice: tip,
                listPriceIncludesTax: true,
            } as any);
        }
        return order;
    }

    /** R5 发单页读起步价：当前渠道 errandBaseFee（null → 默认 200 分） */
    async getErrandBaseFee(ctx: RequestContext): Promise<number> {
        const cfg = await this.connection.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        return cfg?.errandBaseFee ?? 200;
    }
}
