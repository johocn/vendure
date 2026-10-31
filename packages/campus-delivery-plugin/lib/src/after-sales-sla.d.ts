/**
 * 计算售后截止时间。
 * @param createdAt 售后申请时间
 * @param timeoutHours 处理时限（营业小时数）
 * @param businessHours 门店营业时间文案（如 10:00-22:00）；空=全天营业
 * @param pausedMs SLA 暂停累计时长（§95），按线性顺延
 * @returns 截止时间（毫秒时间戳）
 */
export declare function businessDeadline(createdAt: Date | number, timeoutHours: number, businessHours?: string | null, pausedMs?: number): number;
