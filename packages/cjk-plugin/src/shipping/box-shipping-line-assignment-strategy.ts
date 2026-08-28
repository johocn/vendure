import { ID, Injector, Order, OrderLine, RequestContext, ShippingLine, ShippingLineAssignmentStrategy } from '@vendure/core';
import { ShippingProfileService } from './shipping-profile.service';

let shippingProfileService: ShippingProfileService;

/**
 * 按「配送档案分箱」分配 OrderLine → ShippingLine 的自定义策略。
 *
 * 当一个订单被设置多个配送方式（对应多个箱）时，核心的 setShippingMethod 会为每个
 * 配送方式创建一个 ShippingLine，并通过本策略决定每个 ShippingLine 挂哪些 OrderLine。
 * 本策略按变体所属的「已生效配送档案」分箱，把每个箱的 lines 归属到该箱配送方式对应的
 * ShippingLine，从而实现「单订单内多 shippingLine / 多 fulfillment」。
 *
 * 单箱场景退化为默认行为（该箱全部 lines 挂到唯一 ShippingLine）。
 */
export class BoxShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
    init(injector: Injector): void {
        shippingProfileService = injector.get(ShippingProfileService);
    }

    async assignShippingLineToOrderLines(
        ctx: RequestContext,
        shippingLine: ShippingLine,
        order: Order,
    ): Promise<OrderLine[]> {
        const methodId = shippingLine.shippingMethodId;
        const lines = order.lines ?? [];

        // 按生效档案分箱（与 OrderBoxService.computeOrderBoxes 同源逻辑）
        const tenantDefault = await shippingProfileService!.getTenantDefault(ctx);
        const defaultId = tenantDefault?.id ?? null;

        const boxes = new Map<string, OrderLine[]>();
        const orderByProfile: string[] = [];
        for (const line of lines) {
            const variant = (line as any).productVariant;
            const rawPid = variant?.customFields?.shippingProfileId as string | undefined;

            let effectivePid: ID | null = null;
            if (rawPid) {
                const resolved = await shippingProfileService!.resolveEffectiveProfileIds(ctx, [rawPid as any]);
                effectivePid = resolved.length > 0 ? resolved[0] : null;
            }
            if (effectivePid == null) effectivePid = defaultId;
            if (effectivePid == null) continue;

            const key = String(effectivePid);
            if (!boxes.has(key)) {
                boxes.set(key, []);
                orderByProfile.push(key);
            }
            boxes.get(key)!.push(line);
        }

        // 属于该配送方式的箱：其允许的配送方式集合中包含当前 shippingMethod 的箱
        const assigned: OrderLine[] = [];
        for (const key of orderByProfile) {
            const profile = await shippingProfileService!.findOne(ctx, key as any);
            const allowed = profile?.shippingMethods?.map(m => String(m.id)) ?? [];
            if (allowed.includes(String(methodId))) {
                assigned.push(...boxes.get(key)!);
            }
        }
        return assigned;
    }
}