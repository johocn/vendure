"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryEventSubscriber = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const loggerCtx = 'DeliveryEventSubscriber';
const STAFF_CACHE_TTL = 5 * 60 * 1000;
/**
 * @description
 * 订单状态流转到 PaymentSettled 时自动派单。
 *
 * 设计说明：
 * - `deliveryStaffId` 存储 User ID（与 `ctx.activeUserId` 直接比较），不是 Administrator ID。
 * - 按"当前未完成订单数 ASC, lastAssignedAt ASC"选最优送货员。
 * - 候选列表 5 分钟内存缓存，减少 Administrator 查询频次。
 * - 使用 `OrderService.updateCustomFields` 合并写入，避免覆盖其他 customFields。
 * - 直接 `orderRepo.update` 会覆盖整个 customFields JSON，故弃用。
 */
class DeliveryEventSubscriber {
    constructor() {
        this.staffCache = {
            data: [],
            expiredAt: 0,
        };
    }
    init(injector) {
        this.eventBus = injector.get(core_1.EventBus);
        this.connection = injector.get(core_1.TransactionalConnection);
        this.orderService = injector.get(core_1.OrderService);
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(async (event) => {
            // 仅在进入 PaymentSettled 时触发，避免重复派单
            if (event.toState !== 'PaymentSettled')
                return;
            if (event.fromState === 'PaymentSettled')
                return;
            await this.autoAssign(event.ctx, event.order);
        });
    }
    /**
     * 获取候选送货员列表（拥有 delivery-staff Role 的 Administrator）。
     * 5 分钟内存缓存。
     */
    async getCandidates() {
        if (Date.now() < this.staffCache.expiredAt) {
            return this.staffCache.data;
        }
        const adminRepo = this.connection.rawConnection.getRepository(core_1.Administrator);
        const admins = await adminRepo.find({
            relations: ['user', 'user.roles'],
        });
        const candidates = admins.filter((a) => { var _a, _b; return (_b = (_a = a.user) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.some((r) => r.code === 'delivery-staff'); });
        this.staffCache = { data: candidates, expiredAt: Date.now() + STAFF_CACHE_TTL };
        return candidates;
    }
    async autoAssign(ctx, order) {
        var _a, _b;
        try {
            // 已派单则跳过
            if ((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.deliveryStaffId)
                return;
            const candidates = await this.getCandidates();
            if (candidates.length === 0) {
                core_1.Logger.warn(`No delivery staff available for order ${order.code}`, loggerCtx);
                return;
            }
            const orderRepo = this.connection.rawConnection.getRepository(core_1.Order);
            // 查每个候选人的当前未完成订单数与最近派单时间
            const pendingStatuses = [
                constants_1.DeliveryStatus.Assigned,
                constants_1.DeliveryStatus.InProgress,
                constants_1.DeliveryStatus.Exception,
            ];
            const staffWithLoad = await Promise.all(candidates.map(async (admin) => {
                const staffId = String(admin.user.id);
                const pendingCount = await orderRepo
                    .createQueryBuilder('order')
                    .where('order.customFields.deliveryStaffId = :staffId', { staffId })
                    .andWhere('order.customFields.deliveryStatus IN (:...statuses)', {
                    statuses: pendingStatuses,
                })
                    .getCount();
                const lastAssigned = await orderRepo
                    .createQueryBuilder('order')
                    .select('MAX(order.customFields.assignedAt)', 'lastAssignedAt')
                    .where('order.customFields.deliveryStaffId = :staffId', { staffId })
                    .getRawOne();
                return {
                    admin,
                    pendingCount,
                    lastAssignedAt: (lastAssigned === null || lastAssigned === void 0 ? void 0 : lastAssigned.lastAssignedAt)
                        ? new Date(lastAssigned.lastAssignedAt)
                        : new Date(0),
                };
            }));
            staffWithLoad.sort((a, b) => {
                if (a.pendingCount !== b.pendingCount) {
                    return a.pendingCount - b.pendingCount;
                }
                return a.lastAssignedAt.getTime() - b.lastAssignedAt.getTime();
            });
            const chosen = staffWithLoad[0].admin;
            // 关键：存 User ID 而非 Administrator ID，与 ctx.activeUserId 对齐
            const chosenUserId = String(chosen.user.id);
            // 使用 OrderService.updateCustomFields 合并写入，避免覆盖其他 customFields
            await this.orderService.updateCustomFields(ctx, order.id, {
                deliveryStaffId: chosenUserId,
                deliveryStatus: constants_1.DeliveryStatus.Assigned,
                assignedAt: new Date(),
            });
            core_1.Logger.info(`Auto-assigned order ${order.code} to user ${chosenUserId}`, loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Auto-assign failed for order ${order.code}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, loggerCtx);
        }
    }
}
exports.DeliveryEventSubscriber = DeliveryEventSubscriber;
