import { Injector } from '@vendure/core';
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
export declare class DeliveryEventSubscriber {
    private eventBus;
    private connection;
    private orderService;
    private staffCache;
    init(injector: Injector): void;
    /**
     * 获取候选送货员列表（拥有 delivery-staff Role 的 Administrator）。
     * 5 分钟内存缓存。
     */
    private getCandidates;
    private autoAssign;
}
