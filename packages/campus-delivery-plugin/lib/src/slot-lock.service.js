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
};
exports.SlotLockService = SlotLockService;
exports.SlotLockService = SlotLockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SlotLockService);
//# sourceMappingURL=slot-lock.service.js.map