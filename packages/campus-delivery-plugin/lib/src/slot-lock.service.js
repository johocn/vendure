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
     * 支付成功后锁位：先原子「容量 +1」（UPDATE ... WHERE lockedCount < capacity），
     * 再原子认领订单 slotLocked(false→true)；认领失败=支付事件重放/并发二次入厅，归还本次多占容量后返回 true。
     * 先占容量再接单可消除旧实现的竞态窗口：旧实现先认领标记、后判容量，若容量已满再回滚标记，
     * 期间并发事件看到「已认领」会错误返回 true，最终订单未占位却按已锁位入厅（时段超额）。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
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
        // 容量条件直接用列比较：先用读到快照做条件时，管理员并发调低 capacity 会超额锁位
        const res = await this.connection
            .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
            .createQueryBuilder()
            .update(delivery_slot_entity_1.DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < "capacity"', { id: slot.id })
            .execute();
        if (((_c = res.affected) !== null && _c !== void 0 ? _c : 0) <= 0)
            return false; // 时段已满：未写订单标记，无需回滚
        if (Number.isFinite(orderId)) {
            const claim = await this.connection.rawConnection.query('UPDATE "order" SET "customFieldsSlotlocked" = true '
                + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = false RETURNING id', [orderId]);
            const claimed = Array.isArray(claim) && Array.isArray(claim[0]) ? claim[0] : claim;
            if (!Array.isArray(claimed) || !claimed.length) {
                // 已锁位（重放/并发）：本次多占的容量必须归还，否则取消只释放一次会虚增容量
                await this.connection
                    .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
                    .createQueryBuilder()
                    .update(delivery_slot_entity_1.DeliverySlot)
                    .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
                    .where('id = :id', { id: slot.id })
                    .execute();
            }
        }
        return true;
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