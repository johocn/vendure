import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuClient } from './feishu/feishu.client';
/**
 * 售后异常预警推送（§96）：店铺开启后，近 7 日退款率或超时待处理数超过渠道阈值时，
 * 向店铺群推送一条预警（同一天最多一条，由 waimaiAfterSalesAlertLastDay 幂等）。
 * - 退款率口径：近 7 日新建售后单中 Refunded 的单数 / 近 7 日下单量。
 * - 超时口径：当前 Pending 且超过渠道处理时限（已暂停 SLA 的单不计），与工作台一致。
 * - 渠道间用咨询锁隔离，多实例部署不重复推送。
 */
export declare class AfterSalesAnomalyAlertJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private fallback;
    constructor(connection: TransactionalConnection, feishu: FeishuClient);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    run(): Promise<void>;
    private runChannelWithLock;
    runChannel(channelId: number): Promise<void>;
    /** 近 7 日售后指标：下单量 / 退款单数 / 退款率 / 超时待处理 */
    private collect;
    /** 渠道处理时限（小时）：afterSalesTimeoutHours，未配置按 48 */
    private timeoutHours;
    /** 文本预警：只展示已开启阈值的指标，金额/百分比按校园口径 */
    private renderText;
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    private rows;
}
