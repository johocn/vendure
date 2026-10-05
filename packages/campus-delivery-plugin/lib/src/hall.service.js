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
exports.HallService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const slot_lock_service_1 = require("./slot-lock.service");
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
let HallService = class HallService {
    constructor(connection, slotLock) {
        this.connection = connection;
        this.slotLock = slotLock;
    }
    async onOrderPlaced(ctx, order) {
        var _a;
        const cf = order.customFields;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            const locked = await this.slotLock.lock(ctx, order);
            await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
                customFields: Object.assign({ hallStatus: 'open', hallEnteredAt: new Date() }, (locked ? {} : { campusCause: 'slot_full' })),
            });
            core_1.Logger.info(`Order ${order.code} entered hall (${cf.fulfillmentRoute}, slot=${(_a = cf.deliverySlotText) !== null && _a !== void 0 ? _a : 'immediate'}, slotLocked=${locked})`, 'CampusHall');
        }
    }
};
exports.HallService = HallService;
exports.HallService = HallService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        slot_lock_service_1.SlotLockService])
], HallService);
//# sourceMappingURL=hall.service.js.map