import { Order, OrderProcess, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { PACKING_FEE_SKU, quotePackingFee, resolvePackingFeeLabel } from './packing-fee';

/**
 * 打包费/餐盒费落账（P1-1）：在 → ArrangingPayment 过渡时按最终购物车行重算一条 order 级 surcharge。
 * - 跑腿单（orderKind='errand'）豁免：跑腿费/小费不属于餐品打包；
 * - 幂等：先按 sku 标记移除本插件写入的旧打包费，再按最终件数写一条，避免改单/重试叠加；
 * - 商品级覆盖取 line.productVariant.product.customFields.waimaiPackingFee。
 * connection/orderService 由 plugin onApplicationBootstrap 注入（与 min-order.process 同模式）。
 */
let connRef: TransactionalConnection | null = null;
let orderSvcRef: OrderService | null = null;

export function bindPackingFeeDeps(conn: TransactionalConnection, orderService: OrderService) {
    connRef = conn;
    orderSvcRef = orderService;
}

export const campusPackingFeeProcess: OrderProcess<any> = {
    async onTransitionStart(
        fromState: string,
        toState: string,
        { ctx, order }: { ctx: RequestContext; order: Order },
    ) {
        if (toState !== 'ArrangingPayment') return;
        const conn = connRef;
        const orderService = orderSvcRef;
        if (!conn || !orderService) return;
        const cf = (order.customFields ?? {}) as any;
        if (cf.orderKind === 'errand') return;
        const cfg = await conn.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        // 行与商品自定义字段必须重新加载：过渡回调传入的 order 未 join productVariant.product
        const full = await conn.getRepository(ctx, Order).findOne({
            where: { id: order.id as any },
            relations: ['lines', 'lines.productVariant', 'lines.productVariant.product', 'surcharges'],
        });
        if (!full) return;
        for (const s of (full.surcharges ?? []).filter(x => x.sku === PACKING_FEE_SKU)) {
            await orderService.removeSurchargeFromOrder(ctx, full.id as any, s.id as any);
        }
        if (!cfg) return;
        const feeCfg = {
            enabled: cfg.packingFeeEnabled,
            mode: cfg.packingFeeMode,
            amount: cfg.packingFeeAmount,
            cap: cfg.packingFeeCap,
            label: cfg.packingFeeLabel,
        };
        if (!feeCfg.enabled) return;
        const fee = quotePackingFee(feeCfg, (full.lines ?? []).map(line => ({
            packingFee: ((line.productVariant as any)?.product?.customFields?.waimaiPackingFee) ?? null,
            quantity: Number(line.quantity ?? 0),
        })));
        if (fee <= 0) return;
        await orderService.addSurchargeToOrder(ctx, full.id as any, {
            sku: PACKING_FEE_SKU,
            description: resolvePackingFeeLabel(feeCfg),
            listPrice: fee,
            listPriceIncludesTax: true,
        } as any);
    },
};
