// 酒店订单拦截器（P1 防超订接入点）：
// 本 Vendure fork（3.6）无 AddItemToOrderHook，用同版本的 OrderInterceptor（willAdd/willAdjust/willRemove），
// 三者均在 mutation 事务内被 core 调用 → 校验 + 落锁与订单行写入同事务，防超订原子。
// quantity 语义（core 源码口径）：willAddItemToOrder = 本次新增量；willAdjustOrderLine = 调整后目标总量。
import { Injector, Order, OrderInterceptor, OrderLine, RequestContext } from '@vendure/core';
import { Injectable } from '@nestjs/common';
import type { ProductVariant, WillAddItemToOrderInput, WillAdjustOrderLineInput } from '@vendure/core';
import { HotelInventoryService, HotelSoldOutError } from './hotel-inventory.service';

/** date-only 解析（与 C 端传参口径一致：YYYY-MM-DD 前缀即认） */
function toDateOnly(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

/** 行级生效日期：adjust 传新值优先，缺省沿用行上旧值（改数量场景） */
function effectiveDates(cf: Record<string, any> | null | undefined, lineCf: Record<string, any> | null | undefined) {
    const checkIn = toDateOnly(cf?.hotelCheckIn) ?? toDateOnly(lineCf?.hotelCheckIn);
    const checkOut = toDateOnly(cf?.hotelCheckOut) ?? toDateOnly(lineCf?.hotelCheckOut);
    return { checkIn, checkOut };
}

export class HotelOrderInterceptor implements OrderInterceptor {
    private inventory!: HotelInventoryService;

    init(injector: Injector) {
        this.inventory = injector.get(HotelInventoryService);
    }

    /**
     * 加购：酒店行 → 重锁该（订单 × 房型 × 本次日期段）。
     * 同段旧行（core 会把本次累加到它）的 hold 一并重置，目标量 = 旧行数量 + 本次新增；
     * 行尚未创建，落锁 orderLineId=null（adjust/confirm 时回填）。
     */
    async willAddItemToOrder(
        ctx: RequestContext,
        order: Order,
        input: WillAddItemToOrderInput,
    ): Promise<void | string> {
        const { checkIn, checkOut } = effectiveDates(input.customFields as any, null);
        if (!checkIn || !checkOut) return;
        try {
            const existingLine = order.lines.find(
                l =>
                    l.productVariantId === (input.productVariant.id as any)
                    && toDateOnly((l.customFields as any)?.hotelCheckIn) === checkIn
                    && toDateOnly((l.customFields as any)?.hotelCheckOut) === checkOut,
            );
            const totalQty = (existingLine?.quantity ?? 0) + input.quantity;
            await this.inventory.holdForOrder(ctx, order.id, input.productVariant.id, checkIn, checkOut, totalQty, {
                orderLineId: null,
                toReleaseLineIds: existingLine ? [existingLine.id] : [],
            });
        } catch (e) {
            return this.toInterceptorError(e);
        }
    }

    /**
     * 改行（数量/日期）：酒店行 → 先重置本行旧 hold 再按目标量锁新段（同事务，失败整体回滚）。
     * customFields 为 undefined（纯改数量）时沿用行上日期。
     */
    async willAdjustOrderLine(
        ctx: RequestContext,
        order: Order,
        input: WillAdjustOrderLineInput,
    ): Promise<void | string> {
        const lineCf = (input.orderLine.customFields ?? {}) as Record<string, any>;
        const { checkIn, checkOut } = effectiveDates(input.customFields as any, lineCf);
        if (!checkIn || !checkOut) return;
        try {
            await this.inventory.holdForOrder(ctx, order.id, input.orderLine.productVariantId, checkIn, checkOut, input.quantity, {
                orderLineId: input.orderLine.id,
                toReleaseLineIds: [input.orderLine.id],
            });
        } catch (e) {
            return this.toInterceptorError(e);
        }
    }

    /** 移除行：酒店行 → 释放该行全部锁 + 该段内的 orderLineId=null 孤儿锁（同事务随行删除回滚对称） */
    async willRemoveItemFromOrder(ctx: RequestContext, order: Order, orderLine: OrderLine): Promise<void | string> {
        const lineCf = (orderLine.customFields ?? {}) as Record<string, any>;
        const checkIn = toDateOnly(lineCf.hotelCheckIn);
        const checkOut = toDateOnly(lineCf.hotelCheckOut);
        if (!checkIn && !checkOut) return;
        try {
            await this.inventory.releaseLocksByOrderLine(ctx, orderLine.id);
            // willAdd 落锁时行尚未创建（orderLineId=null 孤儿）；同 variant+同 customFields 行 core 会合并，
            // 故「同单同房型同段」即一行，按行日期段释放孤儿不会误伤其他日期段的行
            if (checkIn && checkOut) {
                await this.inventory.releaseOrphanHolds(ctx, order.id, orderLine.productVariantId, checkIn, checkOut);
            }
        } catch (e) {
            return this.toInterceptorError(e);
        }
    }

    private toInterceptorError(e: unknown): string {
        if (e instanceof HotelSoldOutError) {
            // 前端按 interceptorError 前缀 HOTEL_SOLD_OUT 识别并引导改期
            const first = e.shortNights[0];
            const reasonText = first?.reason === 'closed' ? '该日期已关房' : '该日期已满房';
            return `HOTEL_SOLD_OUT|${first?.date ?? ''}|${reasonText}`;
        }
        throw e;
    }
}
