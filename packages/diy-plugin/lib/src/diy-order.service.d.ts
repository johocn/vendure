import { Order, OrderItemPriceCalculationStrategy, OrderService, PriceCalculationResult, ProductVariant, RequestContext, SessionService, TransactionalConnection } from '@vendure/core';
import { DiyShopService } from './diy-shop.service';
import { DiyStockService } from './diy-stock.service';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyPluginOptions } from './types';
/**
 * DIY 成品行定价：OrderLine.customFields.diyUnitPrice > 0 时按它定价（BOM 金额为含税口径、单位分），
 * 否则委托原策略（sales-plugin 改价 / 默认标价）——包装委托式，不影响普通商品（与 sales-plugin 同哲学）。
 */
export declare class DiyOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    private original?;
    constructor(original?: OrderItemPriceCalculationStrategy | undefined);
    calculateUnitPrice(ctx: RequestContext, productVariant: ProductVariant, orderLineCustomFields: {
        [key: string]: any;
    }, order: Order, quantity: number): PriceCalculationResult | Promise<PriceCalculationResult>;
}
/**
 * 载体商品（偏差 2）：bootstrap 幂等创建。enabled=true 才能过 addItemsToOrder 强校验；
 * 实际价格由 diyUnitPrice 覆盖；trackInventory=FALSE（库存由素材侧扣）；仅默认渠道。
 * 逐实体分步 save（不依赖级联）；价格行落 ProductVariantPrice，listPrice 运行时由它算出。
 */
export declare function ensureCarrierProduct(connection: TransactionalConnection): Promise<void>;
/**
 * 方案成单（规格 §6.3）：归属校验 → 服务端实时价复算 → 原子扣库存 → 建单挂 DIY 自定义订单行 → 回写 plan。
 * 全程包在事务里：任一步抛错整体回滚（含已扣库存），无需手动补偿。
 */
export declare class DiyOrderService {
    private options;
    private connection;
    private orderService;
    private sessionService;
    private shopService;
    private stockService;
    constructor(options: DiyPluginOptions, connection: TransactionalConnection, orderService: OrderService, sessionService: SessionService, shopService: DiyShopService, stockService: DiyStockService);
    private get app();
    createOrderFromPlan(ctx: RequestContext, planId: string): Promise<DiyPlan>;
}
