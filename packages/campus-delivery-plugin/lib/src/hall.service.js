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
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const wechat_subscribe_message_plugin_1 = require("@vendure/wechat-subscribe-message-plugin");
const capacity_service_1 = require("./capacity.service");
const slot_lock_service_1 = require("./slot-lock.service");
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
let HallService = class HallService {
    constructor(connection, slotLock, moduleRef, capacity) {
        this.connection = connection;
        this.slotLock = slotLock;
        this.moduleRef = moduleRef;
        this.capacity = capacity;
    }
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    async onOrderPlaced(ctx, order) {
        var _a;
        const cf = order.customFields;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            const locked = await this.slotLock.lock(ctx, order);
            await this.connection.getRepository(ctx, core_2.Order).update(order.id, {
                customFields: Object.assign({ hallStatus: 'open', hallEnteredAt: new Date() }, (locked ? {} : { campusCause: 'slot_full' })),
            });
            core_2.Logger.info(`Order ${order.code} entered hall (${cf.fulfillmentRoute}, slot=${(_a = cf.deliverySlotText) !== null && _a !== void 0 ? _a : 'immediate'}, slotLocked=${locked})`, 'CampusHall');
            this.notifyRiders(ctx, order);
        }
    }
    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用） */
    async backToHall(ctx, orderId) {
        await this.connection.getRepository(ctx, core_2.Order).update(orderId, {
            customFields: { hallStatus: 'open', deliveryStaffId: null, deliveryStatus: null, assignedAt: null },
        });
    }
    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx, orderId, patch) {
        return this.connection.getRepository(ctx, core_2.Order).update(orderId, patch);
    }
    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    notifyRiders(ctx, order) {
        void (async () => {
            var _a, _b, _c;
            try {
                const templateId = ((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {}).orderShippedTemplateId;
                if (!templateId) {
                    core_2.Logger.debug(`Channel ${ctx.channelId} has no orderShippedTemplateId, skip rider notify`, 'CampusHall');
                    return;
                }
                const msg = this.injector.get(wechat_subscribe_message_plugin_1.SubscribeMessageService);
                const riders = await this.capacity.listOnlineRiders(ctx);
                for (const r of riders) {
                    try {
                        await msg.sendCustomMessage(ctx, r.id, templateId, {
                            orderCode: { value: order.code },
                            zone: { value: (_c = order.customFields.campusZone) !== null && _c !== void 0 ? _c : '' },
                        });
                    }
                    catch (e) {
                        core_2.Logger.warn(`rider notify failed (customer ${r.id}): ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusHall');
                    }
                }
            }
            catch (e) {
                core_2.Logger.warn(`rider notify failed: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusHall');
            }
        })();
    }
};
exports.HallService = HallService;
exports.HallService = HallService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        slot_lock_service_1.SlotLockService,
        core_1.ModuleRef,
        capacity_service_1.CapacityService])
], HallService);
//# sourceMappingURL=hall.service.js.map