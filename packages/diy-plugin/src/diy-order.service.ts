import { Inject, Injectable } from '@nestjs/common';
import { GlobalFlag } from '@vendure/common/lib/generated-types';
import {
    Channel,
    CurrencyCode,
    ForbiddenError,
    LanguageCode,
    Logger,
    Order,
    OrderItemPriceCalculationStrategy,
    OrderService,
    PriceCalculationResult,
    Product,
    ProductTranslation,
    ProductVariant,
    ProductVariantPrice,
    ProductVariantTranslation,
    RequestContext,
    TaxCategory,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CalcBom } from '@diy/calc';

import {
    CARRIER_PRODUCT_NAME,
    CARRIER_PRODUCT_SLUG,
    CARRIER_VARIANT_SKU,
    loggerCtx,
    PLUGIN_INIT_OPTIONS,
} from './constants';
import { runDiyCalc } from './calc-bridge';
import { DiyShopService } from './diy-shop.service';
import { DiyStockService, StockItem } from './diy-stock.service';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPluginOptions } from './types';

/**
 * DIY 成品行定价：OrderLine.customFields.diyUnitPrice > 0 时按它定价（BOM 金额为含税口径、单位分），
 * 否则委托原策略（sales-plugin 改价 / 默认标价）——包装委托式，不影响普通商品（与 sales-plugin 同哲学）。
 */
@Injectable()
export class DiyOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    constructor(private original?: OrderItemPriceCalculationStrategy) {}

    calculateUnitPrice(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        order: Order,
        quantity: number,
    ): PriceCalculationResult | Promise<PriceCalculationResult> {
        const diyUnitPrice = orderLineCustomFields?.diyUnitPrice;
        if (diyUnitPrice != null && diyUnitPrice > 0) {
            return { price: diyUnitPrice, priceIncludesTax: true };
        }
        if (this.original) {
            return this.original.calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity);
        }
        return { price: productVariant.listPrice, priceIncludesTax: productVariant.listPriceIncludesTax };
    }
}

/**
 * 载体商品（偏差 2）：bootstrap 幂等创建。enabled=true 才能过 addItemsToOrder 强校验；
 * 实际价格由 diyUnitPrice 覆盖；trackInventory=FALSE（库存由素材侧扣）；仅默认渠道。
 * 逐实体分步 save（不依赖级联）；价格行落 ProductVariantPrice，listPrice 运行时由它算出。
 */
export async function ensureCarrierProduct(connection: TransactionalConnection): Promise<void> {
    const variantRepo = connection.getRepository(ProductVariant);
    const existing = await variantRepo.findOne({ where: { sku: CARRIER_VARIANT_SKU } });
    if (existing) {
        return;
    }
    const taxCategory = await connection.getRepository(TaxCategory).findOne({ where: {} });
    const channel = await connection.getRepository(Channel).findOne({ where: { code: '__default_channel__' } });

    const product = await connection.getRepository(Product).save(
        new Product({ enabled: true, channels: channel ? [channel] : [] }),
    );
    await connection.getRepository(ProductTranslation).save(
        new ProductTranslation({
            languageCode: LanguageCode.zh_Hans,
            name: CARRIER_PRODUCT_NAME,
            slug: CARRIER_PRODUCT_SLUG,
            description: 'DIY 定制成品载体，请通过 DIY 设计器下单',
            base: product,
        }),
    );

    const variant = await variantRepo.save(
        new ProductVariant({
            sku: CARRIER_VARIANT_SKU,
            enabled: true,
            trackInventory: GlobalFlag.FALSE,
            taxCategory: taxCategory ?? undefined,
            product,
            channels: channel ? [channel] : [],
        }),
    );
    await connection.getRepository(ProductVariantTranslation).save(
        new ProductVariantTranslation({ languageCode: LanguageCode.zh_Hans, name: CARRIER_PRODUCT_NAME, base: variant }),
    );
    await connection.getRepository(ProductVariantPrice).save(
        new ProductVariantPrice({ price: 0, currencyCode: CurrencyCode.CNY, variant }),
    );
    Logger.info('[DiyPlugin] carrier product ensured', loggerCtx);
}

/**
 * 方案成单（规格 §6.3）：归属校验 → 服务端实时价复算 → 原子扣库存 → 建单挂 DIY 自定义订单行 → 回写 plan。
 * 全程包在事务里：任一步抛错整体回滚（含已扣库存），无需手动补偿。
 */
@Injectable()
export class DiyOrderService {
    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private shopService: DiyShopService,
        private stockService: DiyStockService,
    ) {}

    private get app(): string {
        return this.options.app ?? 'nshop';
    }

    async createOrderFromPlan(ctx: RequestContext, planId: string): Promise<DiyPlan> {
        const activeUserId = ctx.activeUserId;
        if (!activeUserId) {
            throw new ForbiddenError();
        }
        const userId = Number(activeUserId);
        return this.connection.withTransaction(ctx, async tctx => {
            const planRepo = this.connection.getRepository(tctx, DiyPlan);
            const plan = await planRepo.findOne({ where: { app: this.app, id: Number(planId) } });
            if (!plan || plan.userId !== userId) {
                throw new UserInputError(`Diy plan not found: ${planId}`);
            }
            if (plan.status === 'ordered') {
                throw new UserInputError(`Diy plan ${plan.id} already ordered`);
            }
            const template = await this.connection
                .getRepository(tctx, DiyTemplate)
                .findOne({ where: { id: plan.templateId } });
            if (!template || template.status !== 'enabled') {
                throw new UserInputError(`Diy template not available`);
            }

            // 服务端实时价为唯一成交价；报价价（创建/最近一次报价时的快照）留作参考价
            const quoteRefAmount = plan.bom.totalAmount;
            const materialList = await this.shopService.findShopMaterials(tctx, { onlyEnabled: true, take: 100000 });
            let bom: CalcBom;
            try {
                bom = runDiyCalc(template, plan.spec, materialList.items, tctx.languageCode).bom;
            } catch (e) {
                throw new UserInputError((e as Error).message);
            }

            const stockItems: StockItem[] = bom.items.map(i => ({ materialId: Number(i.materialId), qty: i.qty }));
            const shortages = await this.stockService.deduct(tctx, stockItems);
            if (shortages.length) {
                // 抛错 → 事务回滚，已扣行自动还原（deduct 内部补偿在此场景是冗余但无害）
                throw new UserInputError(
                    `库存不足: ` +
                        shortages.map(s => `${s.code} 需 ${s.required} 现存 ${s.available}`).join('; '),
                );
            }

            const variant = await this.connection
                .getRepository(tctx, ProductVariant)
                .findOne({ where: { sku: CARRIER_VARIANT_SKU } });
            if (!variant) {
                throw new Error(`Carrier variant ${CARRIER_VARIANT_SKU} missing (ensureCarrierProduct 未运行?)`);
            }
            const order = await this.orderService.create(tctx, userId);
            const result = await this.orderService.addItemToOrder(
                tctx,
                order.id,
                variant.id,
                1,
                {
                    diyPlanId: plan.id,
                    diyUnitPrice: bom.totalAmount,
                    diyBom: JSON.stringify(bom),
                    diyQuoteRefAmount: quoteRefAmount,
                },
                ['lines'],
            );
            if (!(result instanceof Order)) {
                throw new UserInputError(result.errorCode);
            }
            plan.status = 'ordered';
            plan.orderLineId = Number(result.lines[result.lines.length - 1].id);
            await planRepo.save(plan);
            return plan;
        });
    }
}
