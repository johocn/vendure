import { Injector, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
export declare class HallService {
    private connection;
    private slotLock;
    private injector;
    private capacity;
    constructor(connection: TransactionalConnection, slotLock: SlotLockService, injector: Injector, capacity: CapacityService);
    onOrderPlaced(ctx: RequestContext, order: Order): Promise<void>;
    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    private notifyRiders;
}
