import { Injectable } from '@nestjs/common';
import { ID, Order, OrderService, RequestContext, UserInputError, isGraphQlErrorResult } from '@vendure/core';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
import { BALANCE_PAYMENT_CODE } from './order-box-aggregation';

/**
 * 订单分箱结果（Box）。
 * 分箱键 = 变体 customFields.shippingProfileId（配送档案）：
 * - 同档案合箱；
 * - 未绑定/已停用档案 → 依据 ShippingProfileService.resolveEffectiveProfileIds 回退到租户默认档案并入其分组。
 */
export interface OrderBox {
    /** 箱的唯一稳定标识（`box:<profileId>`） */
    boxKey: string;
    /** 生效配送档案 id；未解析到任何档案时为 null */
    profileId: ID | null;
    /** 生效配送档案名称 */
    profileName: string;
    /** 落入该箱的 OrderLine id 列表 */
    lineIds: ID[];
    /** 箱型：pickup=自提类，delivery=物流类 */
    type: 'delivery' | 'pickup';
    /** 该箱所在租户渠道 id */
    tenantChannelId: ID;
    /** 落入该箱的原始变体配送档案 id（去重，含回退前的原始绑定） */
    shippingProfileIds: ID[];
    /** 该箱配送档案允许的可用配送方式 id（已过滤停用） */
    availableShippingMethodIds: ID[];
    /** 该箱默认配送方式 id（可用集合中第一个），用于未显式选择时的兜底 */
    defaultShippingMethodId: ID | null;
    /** 该箱允许的自提点集合 */
    pickupLocations: PickupLocation[];
    /** 该箱可用支付方式 code 集合（来自配送档案绑定的支付档案，供聚合拆合引擎用） */
    availablePaymentMethodCodes: string[];
    /** 该箱是否需要收货地址（物流档案=true） */
    requiresAddress: boolean;
    /** 该箱是否需要联系方式（到店需联系方式档案=true） */
    requiresContact: boolean;
}

@Injectable()
export class OrderBoxService {
    constructor(
        private shippingProfileService: ShippingProfileService,
        private paymentProfileService: PaymentProfileService,
        private orderService: OrderService,
    ) {}

    /**
     * 将一个订单的 order lines 按「已生效配送档案」分组为若干箱。
     *
     * 规则（对齐 spec §2.3 / resolveEffectiveProfileIds）：
     * - 变体绑定档案若停用（enabled=false）→ 视为未绑定，回退到租户默认档案；
     * - 变体未绑定任何档案 → 直接回退到租户默认档案；
     * - 同一生效档案的 line 合并为同一箱（跨租户/跨档案自动分箱）。
     */
    async computeOrderBoxes(ctx: RequestContext, order: Order): Promise<OrderBox[]> {
        const lines = order.lines ?? [];
        if (lines.length === 0) return [];

        const tenantDefault = await this.shippingProfileService.getTenantDefault(ctx);
        const defaultId = tenantDefault?.id ?? null;

        // 组：lineIds + 原始 raw profile ids
        const groups = new Map<string, { lineIds: ID[]; rawIds: Set<string> }>();
        const orderByProfile: string[] = [];

        for (const line of lines) {
            const variant = (line as any).productVariant;
            const rawPid = variant?.customFields?.shippingProfileId as ID | undefined;

            let effectivePid: ID | null = null;
            if (rawPid) {
                const resolved = await this.shippingProfileService.resolveEffectiveProfileIds(ctx, [rawPid]);
                effectivePid = resolved.length > 0 ? resolved[0] : null;
            }
            if (effectivePid == null) {
                effectivePid = defaultId;
            }
            if (effectivePid == null) continue;

            const key = String(effectivePid);
            if (!groups.has(key)) {
                groups.set(key, { lineIds: [], rawIds: new Set<string>() });
                orderByProfile.push(key);
            }
            const group = groups.get(key)!;
            group.lineIds.push(line.id as ID);
            if (rawPid) group.rawIds.add(String(rawPid));
        }

        const boxes: OrderBox[] = [];
        for (const key of orderByProfile) {
            const group = groups.get(key)!;
            const profile = await this.shippingProfileService.findOne(ctx, key as any);

            const enabledMethods = profile?.shippingMethods?.length
                ? (await this.shippingProfileService.findShippingMethodsByIds(
                      ctx,
                      profile.shippingMethods.map(m => m.id as ID),
                  )).filter((m: any) => m.customFields?.enabled !== false)
                : [];

            boxes.push({
                boxKey: `box:${key}`,
                profileId: key as ID,
                profileName: profile?.name ?? key,
                lineIds: group.lineIds,
                type: profile?.pickupLocations?.length ? 'pickup' : 'delivery',
                tenantChannelId: order.channels?.[0]?.id ?? ctx.channelId,
                shippingProfileIds: [...group.rawIds] as ID[],
                availableShippingMethodIds: enabledMethods.map((m: any) => m.id as ID),
                defaultShippingMethodId: enabledMethods.length > 0 ? (enabledMethods[0].id as ID) : null,
                pickupLocations: profile?.pickupLocations ?? [],
                availablePaymentMethodCodes: await this.resolvePaymentCodesForProfile(ctx, key as ID),
                requiresAddress: profile?.requiresAddress ?? true,
                requiresContact: profile?.requiresContact ?? false,
            });
        }
        return boxes;
    }

    /**
     * 读取订单已保存的分箱选择（boxShippingSelections customField 中的 JSON）。
     * 结构：{ [boxKey]: { shippingMethodId, pickupLocationId } }
     */
    getBoxSelections(order: Order): Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }> {
        return this.readSelections(order);
    }

    private readSelections(order: Order): Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }> {
        const raw = (order as any).customFields?.boxShippingSelections;
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    /**
     * 解析某配送档案可用的支付方式 code 集合（供聚合拆合引擎判定每箱支付白名单）。
     * - 配送档案绑定支付档案 → 用其全部支付方式 code；
     * - 未绑定 → 回退租户默认支付档案。
     */
    async resolvePaymentCodesForProfile(ctx: RequestContext, shippingProfileId: ID): Promise<string[]> {
        const payProfile = await this.shippingProfileService.getPaymentProfileForShippingProfile(ctx, shippingProfileId);
        const codes = payProfile
            ? (await this.paymentProfileService.getIntersectedPaymentMethods(ctx, [payProfile.id])).map(m => m.code)
            : [];
        // 余额为所有配送档案的内建基础方式（全局共享钱包），始终并入白名单，供前端/聚合引擎启用「余额合单」路径。
        if (!codes.includes(BALANCE_PAYMENT_CODE)) {
            codes.push(BALANCE_PAYMENT_CODE);
        }
        return codes;
    }

    /** 兼容单箱传入的支付方式白名单解析。 */
    async resolvePaymentCodesForBox(ctx: RequestContext, box: Pick<OrderBox, 'profileId'>): Promise<string[]> {
        if (!box.profileId) return [];
        return this.resolvePaymentCodesForProfile(ctx, box.profileId);
    }

    /**
     * 为订单内一组箱设置配送方式（一次性调核心 setShippingMethod，多 fulfillment）。
     *
     * selections 可选：传入则为各箱配送方式选择快照（用于拆单时把源订单的选择带给新订单）；
     * 未传则读取 order.customFields.boxShippingSelections。每箱未显式选择时用该箱默认配送方式兜底。
     */
    async setShippingForOrder(
        ctx: RequestContext,
        order: Order,
        boxKeys: string[],
        selections?: Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }>,
    ): Promise<Order> {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const effectiveKeys = boxes.filter(b => boxKeys.includes(b.boxKey)).map(b => b.boxKey);
        if (effectiveKeys.length === 0) return order;
        const selectionsMap = selections ?? this.readSelections(order);

        const orderedMethodIds = boxes
            .filter(b => effectiveKeys.includes(b.boxKey))
            .map(b => selectionsMap[b.boxKey]?.shippingMethodId ?? b.defaultShippingMethodId)
            .filter((id): id is ID => !!id);
        if (orderedMethodIds.length === 0) return order;

        const result = await this.orderService.setShippingMethod(ctx, order.id, orderedMethodIds);
        if (isGraphQlErrorResult(result)) {
            throw new UserInputError((result as any).message ?? 'SET_SHIPPING_METHOD_FAILED');
        }
        return this.orderService.findOne(ctx, order.id) as Promise<Order>;
    }

    /**
     * 为某一箱设置配送方式（并把该箱的 lines 通过核心 setShippingMethod 关联到对应 ShippingLine）。
     *
     * 实现了「单订单内多配送组」的统一骨架：
     * - 依据各箱当前选择 + 默认兜底，构造整单配送方式 id 数组，一次调用核心
     *   setShippingMethod（配合 BoxShippingLineAssignmentStrategy，每个 ShippingLine 只挂其箱内 lines）。
     * - pickupLocationId 仅供自提类方式使用，写入该箱选择快照。
     *
     * 注意：核心结算入口是整单级的（eligibility/price 针对整单计算，非该箱 line 子集），
     * 自提（免费/固定价）方式不受影响；阶梯重量/件数等按整单计费的方式无法按箱独立计价，见报告。
     */
    async setBoxShippingMethod(
        ctx: RequestContext,
        order: Order,
        boxKey: string,
        shippingMethodId: ID,
        pickupLocationId?: ID,
    ): Promise<Order> {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const box = boxes.find(b => b.boxKey === boxKey);
        if (!box) {
            throw new UserInputError(`BOX_NOT_FOUND:${boxKey}`);
        }
        const sid = String(shippingMethodId);
        if (!box.availableShippingMethodIds.some(id => String(id) === sid)) {
            throw new UserInputError('BOX_SHIPPING_METHOD_INVALID');
        }

        const selections = this.readSelections(order);
        selections[boxKey] = {
            shippingMethodId: sid as ID,
            pickupLocationId: pickupLocationId ? (String(pickupLocationId) as ID) : null,
        };

        await this.setShippingForOrder(ctx, order, boxes.map(b => b.boxKey), selections);

        await this.orderService.updateCustomFields(ctx, order.id, {
            boxShippingSelections: JSON.stringify(selections),
        } as any);

        return this.orderService.findOne(ctx, order.id) as Promise<Order>;
    }
}