"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelOrderInterceptor = void 0;
const hotel_inventory_service_1 = require("./hotel-inventory.service");
/** date-only 解析（与 C 端传参口径一致：YYYY-MM-DD 前缀即认） */
function toDateOnly(v) {
    if (typeof v !== 'string')
        return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}
/** 行级生效日期：adjust 传新值优先，缺省沿用行上旧值（改数量场景） */
function effectiveDates(cf, lineCf) {
    var _a, _b;
    const checkIn = (_a = toDateOnly(cf === null || cf === void 0 ? void 0 : cf.hotelCheckIn)) !== null && _a !== void 0 ? _a : toDateOnly(lineCf === null || lineCf === void 0 ? void 0 : lineCf.hotelCheckIn);
    const checkOut = (_b = toDateOnly(cf === null || cf === void 0 ? void 0 : cf.hotelCheckOut)) !== null && _b !== void 0 ? _b : toDateOnly(lineCf === null || lineCf === void 0 ? void 0 : lineCf.hotelCheckOut);
    return { checkIn, checkOut };
}
class HotelOrderInterceptor {
    init(injector) {
        this.inventory = injector.get(hotel_inventory_service_1.HotelInventoryService);
    }
    /**
     * 加购：酒店行 → 重锁该（订单 × 房型 × 本次日期段）。
     * 同段旧行（core 会把本次累加到它）的 hold 一并重置，目标量 = 旧行数量 + 本次新增；
     * 行尚未创建，落锁 orderLineId=null（adjust/confirm 时回填）。
     */
    async willAddItemToOrder(ctx, order, input) {
        var _a;
        const { checkIn, checkOut } = effectiveDates(input.customFields, null);
        if (!checkIn || !checkOut)
            return;
        try {
            const existingLine = order.lines.find(l => {
                var _a, _b;
                return l.productVariantId === input.productVariant.id
                    && toDateOnly((_a = l.customFields) === null || _a === void 0 ? void 0 : _a.hotelCheckIn) === checkIn
                    && toDateOnly((_b = l.customFields) === null || _b === void 0 ? void 0 : _b.hotelCheckOut) === checkOut;
            });
            const totalQty = ((_a = existingLine === null || existingLine === void 0 ? void 0 : existingLine.quantity) !== null && _a !== void 0 ? _a : 0) + input.quantity;
            await this.inventory.holdForOrder(ctx, order.id, input.productVariant.id, checkIn, checkOut, totalQty, {
                orderLineId: null,
                toReleaseLineIds: existingLine ? [existingLine.id] : [],
            });
        }
        catch (e) {
            return this.toInterceptorError(e);
        }
    }
    /**
     * 改行（数量/日期）：酒店行 → 先重置本行旧 hold 再按目标量锁新段（同事务，失败整体回滚）。
     * customFields 为 undefined（纯改数量）时沿用行上日期。
     */
    async willAdjustOrderLine(ctx, order, input) {
        var _a;
        const lineCf = ((_a = input.orderLine.customFields) !== null && _a !== void 0 ? _a : {});
        const { checkIn, checkOut } = effectiveDates(input.customFields, lineCf);
        if (!checkIn || !checkOut)
            return;
        try {
            await this.inventory.holdForOrder(ctx, order.id, input.orderLine.productVariantId, checkIn, checkOut, input.quantity, {
                orderLineId: input.orderLine.id,
                toReleaseLineIds: [input.orderLine.id],
            });
        }
        catch (e) {
            return this.toInterceptorError(e);
        }
    }
    /** 移除行：酒店行 → 释放该行全部锁 + 该段内的 orderLineId=null 孤儿锁（同事务随行删除回滚对称） */
    async willRemoveItemFromOrder(ctx, order, orderLine) {
        var _a;
        const lineCf = ((_a = orderLine.customFields) !== null && _a !== void 0 ? _a : {});
        const checkIn = toDateOnly(lineCf.hotelCheckIn);
        const checkOut = toDateOnly(lineCf.hotelCheckOut);
        if (!checkIn && !checkOut)
            return;
        try {
            await this.inventory.releaseLocksByOrderLine(ctx, orderLine.id);
            // willAdd 落锁时行尚未创建（orderLineId=null 孤儿）；同 variant+同 customFields 行 core 会合并，
            // 故「同单同房型同段」即一行，按行日期段释放孤儿不会误伤其他日期段的行
            if (checkIn && checkOut) {
                await this.inventory.releaseOrphanHolds(ctx, order.id, orderLine.productVariantId, checkIn, checkOut);
            }
        }
        catch (e) {
            return this.toInterceptorError(e);
        }
    }
    toInterceptorError(e) {
        var _a;
        if (e instanceof hotel_inventory_service_1.HotelSoldOutError) {
            // 前端按 interceptorError 前缀 HOTEL_SOLD_OUT 识别并引导改期
            const first = e.shortNights[0];
            const reasonText = (first === null || first === void 0 ? void 0 : first.reason) === 'closed' ? '该日期已关房' : '该日期已满房';
            return `HOTEL_SOLD_OUT|${(_a = first === null || first === void 0 ? void 0 : first.date) !== null && _a !== void 0 ? _a : ''}|${reasonText}`;
        }
        throw e;
    }
}
exports.HotelOrderInterceptor = HotelOrderInterceptor;
//# sourceMappingURL=hotel-order-interceptor.js.map