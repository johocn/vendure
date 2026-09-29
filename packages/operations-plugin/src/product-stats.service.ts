// d:\zhao\vendure\packages\operations-plugin\src\product-stats.service.ts
import { Injectable } from '@nestjs/common';
import {
    ID,
    OrderLine,
    Product,
    ProductService,
    ProductVariantPrice,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

/**
 * 计入销量的订单状态白名单 = 「已支付及之后」。
 * AddingItems / ArrangingPayment / PaymentAuthorized / Modifying / ArrangingAdditionalPayment /
 * Draft / Cancelled 天然排除（草稿单处于 Draft 状态，无需额外过滤）。
 */
export const COUNTED_ORDER_STATES = [
    'PaymentSettled',
    'PartiallyShipped',
    'Shipped',
    'PartiallyDelivered',
    'Delivered',
];

/** 全量重算的分页大小 */
const PRODUCT_PAGE_SIZE = 200;

/**
 * @description
 * 商品展示值（销量 / 可得积分）重算服务。
 *
 * 写回规则：
 * - salesCount     = realSalesCount + bonusSales
 * - pointsReward   = pointsRewardOverride ?? floor(最低变体不含税价)
 *
 * 幂等：结果只由「订单聚合 + 变体价格 + 后台基数/覆盖」决定，与执行上下文（渠道、时间）无关；
 * 写前比对，值未变化则不调用 ProductService.update —— 这同时切断了 ProductEvent 的自激循环。
 */
@Injectable()
export class ProductStatsService {
    constructor(
        private connection: TransactionalConnection,
        private productService: ProductService,
    ) {}

    /** 全量重算（分页遍历所有**未软删除**的商品）。返回本次实际被更新的商品数。 */
    async recomputeAll(ctx: RequestContext): Promise<number> {
        let skip = 0;
        let updated = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const page: Product[] = await this.findAliveProducts(ctx, {
                skip,
                take: PRODUCT_PAGE_SIZE,
            });
            if (page.length === 0) {
                break;
            }
            updated += await this.recomputeForProducts(
                ctx,
                page.map(p => p.id),
            );
            if (page.length < PRODUCT_PAGE_SIZE) {
                break;
            }
            skip += PRODUCT_PAGE_SIZE;
        }
        return updated;
    }

    /**
     * 按商品重算并写回展示值。返回本次实际被更新的商品数。
     * 与库中现值完全一致的商品会被跳过（不写库、不发事件）。
     */
    async recomputeForProducts(ctx: RequestContext, productIds: ID[]): Promise<number> {
        const ids = [...new Set(productIds.map(id => Number(id)))].filter(id => Number.isFinite(id));
        if (ids.length === 0) {
            return 0;
        }

        const [salesMap, priceMap, products] = await Promise.all([
            this.aggregateSales(ctx, ids),
            this.aggregateMinPrices(ctx, ids),
            this.findAliveProducts(ctx, { ids }),
        ]);

        let updated = 0;
        for (const product of products) {
            const cf: any = (product as any).customFields ?? {};
            const realSalesCount = salesMap.get(Number(product.id)) ?? 0;
            const bonusSales = Number(cf.bonusSales ?? 0);
            const salesCount = realSalesCount + bonusSales;
            const override = cf.pointsRewardOverride;
            const pointsReward = override != null ? Number(override) : (priceMap.get(Number(product.id)) ?? 0);

            const unchanged =
                Number(cf.realSalesCount ?? 0) === realSalesCount &&
                Number(cf.salesCount ?? 0) === salesCount &&
                Number(cf.pointsReward ?? 0) === pointsReward;
            if (unchanged) {
                continue;
            }

            await this.productService.update(ctx, {
                id: product.id,
                customFields: { realSalesCount, salesCount, pointsReward } as any,
            });
            updated++;
        }
        return updated;
    }

    /**
     * 取**未软删除**的商品。
     *
     * 注意：`Product.deletedAt` 是普通 `@Column`（不是 `@DeleteDateColumn`，Vendure 用 `SoftDeletable`
     * 自行管理软删除），因此 TypeORM 的 `find()` **不会**自动过滤软删除行；而 `ProductService.update`
     * 内部会过滤。把软删除商品交给 `update` 就会抛 `EntityNotFoundError`（线上已被这个坑打到：
     * `product` 表 83 行里仅 18 行存活，全量重算时第一个软删除行 id=1 直接报 `No Product with the id "1"`）。
     * 这里显式排除 `deletedAt IS NOT NULL`。
     */
    private findAliveProducts(
        ctx: RequestContext,
        options: { ids?: number[]; skip?: number; take?: number },
    ): Promise<Product[]> {
        const qb = this.connection
            .getRepository(ctx, Product)
            .createQueryBuilder('product')
            .where('product.deletedAt IS NULL');
        if (options.ids) {
            return qb.andWhere('product.id IN (:...ids)', { ids: options.ids }).getMany();
        }
        return qb
            .orderBy('product.id', 'ASC')
            .skip(options.skip ?? 0)
            .take(options.take ?? PRODUCT_PAGE_SIZE)
            .getMany();
    }

    /**
     * 真实销量：Σ orderLine.quantity，仅计已支付及之后状态的订单；**全渠道合计**
     * （Product 是全局实体，销量不按渠道拆分，见 spec §9 取舍 1）。
     */
    private async aggregateSales(ctx: RequestContext, productIds: number[]): Promise<Map<number, number>> {
        const rows = await this.connection
            .getRepository(ctx, OrderLine)
            .createQueryBuilder('line')
            .innerJoin('line.order', 'o')
            .innerJoin('line.productVariant', 'v')
            .select('v.productId', 'productId')
            .addSelect('SUM(line.quantity)', 'qty')
            .where('o.state IN (:...states)', { states: COUNTED_ORDER_STATES })
            .andWhere('v.productId IN (:...productIds)', { productIds })
            .groupBy('v.productId')
            .getRawMany<{ productId: number; qty: string }>();

        const map = new Map<number, number>();
        for (const row of rows) {
            map.set(Number(row.productId), Number(row.qty));
        }
        return map;
    }

    /**
     * 最低变体价（不含税、单位分）：`product_variant_price` 表的**全渠道最低价**。
     * 取全渠道而非 ctx.channelId，是为了让重算结果与执行上下文无关（三条触发路径的 ctx 渠道可能不同）。
     */
    private async aggregateMinPrices(ctx: RequestContext, productIds: number[]): Promise<Map<number, number>> {
        const rows = await this.connection
            .getRepository(ctx, ProductVariantPrice)
            .createQueryBuilder('pvp')
            .innerJoin('pvp.variant', 'v')
            .select('v.productId', 'productId')
            .addSelect('MIN(pvp.price)', 'minPrice')
            .where('v.productId IN (:...productIds)', { productIds })
            .groupBy('v.productId')
            .getRawMany<{ productId: number; minPrice: string }>();

        const map = new Map<number, number>();
        for (const row of rows) {
            map.set(Number(row.productId), Math.floor(Number(row.minPrice)));
        }
        return map;
    }
}
