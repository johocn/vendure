import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class Feedback extends VendureEntity {
    constructor(input?: DeepPartial<Feedback>);
    customerId: number;
    /** 功能异常/体验问题/其他 */
    type: string;
    /** ≤20 字（对齐 usemall） */
    title: string;
    content: string;
    /** JSON 字符串数组（uploadCustomerAsset 的 source 列表） */
    imgs: string | null;
    /** ≤30 字 */
    contactWay: string | null;
    status: 'pending' | 'processing' | 'resolved';
    /** 日期列省略 type（2026-10-08 教训：显式 datetime/timestamp 在 sqljs 下报 DataTypeNotSupportedError） */
    handledAt: Date;
    /** 管理员回复（回复即闭环；C 端 myFeedbacks 透出） */
    reply: string | null;
    /** 日期列省略 type（sqljs 兼容，同 handledAt） */
    repliedAt: Date;
    repliedBy: string | null;
    /** 用户已读标记：未读 = readAt IS NULL AND status != 'pending'（类型与 handledAt 同构：省略 type 由驱动自适应 PG/SQLite；清空赋值在 service 用 as any） */
    readAt: Date;
}
