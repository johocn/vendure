import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 补偿任务（R2）：券/站内信等旁路动作失败后落库，由定时任务退避重试。
 * 主流程（退款/取消）永远不因补偿失败而回滚；本表只负责「最终一致」。
 */
export declare class CampusCompensationTask extends VendureEntity {
    [key: string]: any;
    orderId: number;
    channelId: number;
    customerId: number | null;
    /** coupon=补发补偿券；notify=补发站内信 */
    kind: 'coupon' | 'notify';
    /** 任务参数 JSON（券：templateId/orderCode；通知：event/text） */
    payload: string | null;
    /** 幂等键：同键任务只允许一条（唯一索引） */
    dedupeKey: string;
    status: 'pending' | 'done' | 'failed';
    attempts: number;
    /** 下次重试时间（退避）；done/failed 后置 null */
    nextAttemptAt: Date | null;
    lastError: string | null;
    constructor(input?: DeepPartial<CampusCompensationTask>);
}
