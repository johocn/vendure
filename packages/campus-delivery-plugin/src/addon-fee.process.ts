import { Order, OrderProcess, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { ADDON_FEE_SKU, quoteAddonFee } from './addon-fee';

/**
 * 加料费落账（P1-2）：→ ArrangingPayment 过渡时按行内加料引用汇总一条 order 级 surcharge。
 * - 与 campusPackingFeeProcess 同模式：跑腿单豁免；幂等（先按 sku 删旧再加新）；
 * - 金额不取前端上传值：OrderLine.customFields.waimaiAddons 只存 `[{g,n}]` 引用，
 *   单价一律按商品当前配置（waimaiAddonGroups）服务端解析，未知引用直接丢弃。
 */
let connRef: TransactionalConnection | null = null;
let orderSvcRef: OrderService | null = null;

export function bindAddonFeeDeps(conn: TransactionalConnection, orderService: OrderService) {
    connRef = conn;
    orderSvcRef = orderService;
}

/** surcharge 展示名（C 端按 sku 本地化，后台/小票直接用该文案） */
export const ADDON_FEE_LABEL = '加料费';

export const campusAddonFeeProcess: OrderProcess<any> = {
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
        // 行与商品自定义字段必须重新加载：过渡回调传入的 order 未 join productVariant.product
        const full = await conn.getRepository(ctx, Order).findOne({
            where: { id: order.id as any },
            relations: ['lines', 'lines.productVariant', 'lines.productVariant.product', 'surcharges'],
        });
        if (!full) return;
        const existing = (full.surcharges ?? []).filter(x => x.sku === ADDON_FEE_SKU);
        for (const s of existing) {
            await orderService.removeSurchargeFromOrder(ctx, full.id as any, s.id as any);
        }
        const fee = quoteAddonFee(
            (full.lines ?? []).map(line => ({
                addons: (line.customFields as any)?.waimaiAddons,
                groups: ((line.productVariant as any)?.product?.customFields as any)?.waimaiAddonGroups,
                quantity: Number(line.quantity ?? 0),
            })),
        );
        if (fee <= 0) return;
        await orderService.addSurchargeToOrder(ctx, full.id as any, {
            sku: ADDON_FEE_SKU,
            description: ADDON_FEE_LABEL,
            listPrice: fee,
            listPriceIncludesTax: true,
        } as any);
    },
};
