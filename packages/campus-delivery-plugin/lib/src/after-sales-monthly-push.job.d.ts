import { OnApplicationShutdown } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { FeishuClient } from './feishu/feishu.client';
/**
 * 售后月度摘要推送（§95）：店铺开启后，每月指定日（默认 1 日）到设定时间，
 * 把「上一个自然月」的售后汇总推到店铺群（feishu broadcast，channel=店铺 code）。
 * - 口径：按校园时区（UTC+8）自然月切分；新建单按 createdAt，退款按 refundedAt。
 * - 幂等：Channel.waimaiAfterSalesMonthlyPushLastMonth 记已推送月份；同月只推一条，改设置不会重复推。
 * - 漏推补发：当天错过后，只要月份未推送且已过设定日/时刻，下一轮自动补推。
 * - 渠道间用咨询锁隔离，多实例部署不重复推送。
 */
export declare class AfterSalesMonthlyPushJob implements OnApplicationShutdown {
    private connection;
    private feishu;
    private fallback;
    constructor(connection: TransactionalConnection, feishu: FeishuClient);
    start(): void;
    stop(): void;
    onApplicationShutdown(): void;
    /** 扫描全部启用了售后月报推送的渠道（未配置飞书发送能力时整体跳过） */
    run(): Promise<void>;
    private runChannelWithLock;
    runChannel(channelId: number): Promise<void>;
    /** 上月售后汇总：新建单 / 退款 / 超时待处理 / 满意度（满意度表缺失时降级为 0） */
    private buildReport;
    /** 渠道售后处理时限（小时，与商家端同口径：customFields.afterSalesTimeoutHours，默认 48） */
    private timeoutHours;
    /** 文本月报：金额分转元；无数据的行整行省略，避免「—」噪声 */
    private renderText;
    /** 校园时区（UTC+8）自然月起点的毫秒时间戳 */
    private campusMonthStart;
    /** 'HH:MM' 归一；为空/非法按 21:30（写入口已校验，这里只做兜底） */
    private normalizeTime;
    private minutesOf;
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    private rows;
}
