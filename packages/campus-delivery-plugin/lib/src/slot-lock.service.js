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
const core_2 = require("@vendure/core");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
let SlotLockService = class SlotLockService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     */
    async lock(ctx, order) {
        var _a, _b;
        const slotId = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.deliverySlotId;
        if (!slotId)
            return true; // 未选时段（立即单）跳过
        const slot = await this.connection.getRepository(ctx, delivery_slot_entity_1.DeliverySlot).findOne({ where: { id: slotId } });
        if (!slot) {
            core_1.Logger.warn(`Order ${order === null || order === void 0 ? void 0 : order.code} slot ${slotId} not found, skip lock`, 'CampusSlot');
            return true; // 时段被管理员删除：不阻断，靠 T3 告警人工跟进
        }
        const res = await this.connection
            .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
            .createQueryBuilder()
            .update(delivery_slot_entity_1.DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < :cap', { id: slot.id, cap: slot.capacity })
            .execute();
        return ((_b = res.affected) !== null && _b !== void 0 ? _b : 0) > 0;
    }
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 仅由「Cancelled 状态转换」调用一次（状态机保证每单只触发一次），
     * 因此无需额外幂等标记；lockedCount 用 GREATEST 兜底防负数。
     */
    async unlock(ctx, orderId) {
        var _a, _b;
        const order = await this.connection.getRepository(ctx, core_2.Order).findOne({
            where: { id: orderId },
        });
        const slotId = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.deliverySlotId;
        if (!slotId)
            return false;
        const res = await this.connection
            .getRepository(ctx, delivery_slot_entity_1.DeliverySlot)
            .createQueryBuilder()
            .update(delivery_slot_entity_1.DeliverySlot)
            .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
            .where('id = :id', { id: slotId })
            .execute();
        core_1.Logger.info(`Order ${order === null || order === void 0 ? void 0 : order.code} slot ${slotId} released`, 'CampusSlot');
        return ((_b = res.affected) !== null && _b !== void 0 ? _b : 0) > 0;
    }
};
exports.SlotLockService = SlotLockService;
exports.SlotLockService = SlotLockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SlotLockService);
//# sourceMappingURL=slot-lock.service.js.map