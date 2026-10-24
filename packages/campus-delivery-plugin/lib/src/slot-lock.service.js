"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotLockService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
let SlotLockService = class SlotLockService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     * 幂等：先原子认领订单 slotLocked(false→true)，认领失败=已锁过（支付事件重放/并发二次入厅），
     * 直接返回 true 不再递增容量；若容量已满则回滚认领，避免取消时误减造成容量虚增。
     */
    async lock(ctx, order) {
        var _a, _b, _c;
        const slotId = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.deliverySlotId;
        if (!slotId)
            return true; // 未选时段（立即单）跳过
        const slot = await this.connection.getRepository(ctx, delivery_slot_entity_1.DeliverySlot).findOne({ where: { id: slotId } });
        if (!slot) {
            core_1.Logger.warn(`Order ${order === null || order === void 0 ? void 0 : order.code} slot ${slotId} not found, skip lock`, 'CampusSlot');
            return true; // 时段被管理员删除：不阻断，靠 T3 告警人工跟进
        }
        const orderId = Number((_b = order === null || order === void 0 ? void 0 : order.id) !== null && _b !== void 0 ? _b : NaN);
        if (Number.isFinite(orderId)) {
            const claim = await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsSlotlocked" = true '
                + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = false RETURNING id', [orderId]);
            const claimed = Array.isArray(claim) && Array.isArray(claim[0]) ? claim[0] : claim;
            if (!Array.isArray(claimed) || !claimed.length)
                return true; // 已锁位：幂等跳过
        }
        const res = await this.connection
            .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
            .createQueryBuilder()
            .update(delivery_slot_entity_1.DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < :cap', { id: slot.id, cap: slot.capacity })
            .execute();
        const ok = ((_c = res.affected) !== null && _c !== void 0 ? _c : 0) > 0;
        if (!ok && Number.isFinite(orderId)) {
            // 时段已满：回滚认领标记（未真正占位，取消时不得释放名额）
            await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsSlotlocked" = false WHERE id = $1', [orderId]);
        }
        return ok;
    }
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 原子认领 slotLocked=true → false，保证「同一单只释放一次」，且未锁位/锁位失败的单一律不释放。
     * 返回 true 表示本次确实归还了一个名额。
     */
    async unlock(ctx, orderId) {
        var _a, _b;
        const claimed = await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsSlotlocked" = false '
            + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = true '
            + 'RETURNING "customFieldsDeliveryslotid" AS slot', [orderId]);
        const rows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
        const slotId = (_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.slot;
        if (!slotId)
            return false; // 未锁位（未支付取消 / 时段已满 / 已释放过）
        const res = await this.connection
            .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
            .createQueryBuilder()
            .update(delivery_slot_entity_1.DeliverySlot)
            .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
            .where('id = :id', { id: slotId })
            .execute();
        core_1.Logger.info(`Order ${orderId} slot ${slotId} released`, 'CampusSlot');
        return ((_b = res.affected) !== null && _b !== void 0 ? _b : 0) > 0;
    }
};
exports.SlotLockService = SlotLockService;
exports.SlotLockService = SlotLockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SlotLockService);
//# sourceMappingURL=slot-lock.service.js.map