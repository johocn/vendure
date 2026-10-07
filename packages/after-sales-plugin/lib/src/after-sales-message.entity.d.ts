import { DeepPartial, VendureEntity } from '@vendure/core';
import { AfterSalesRequest } from './after-sales-request.entity';
/** 留言发送方类型：customer=顾客 / admin=商家管理员 */
export type AfterSalesMessageSenderType = 'customer' | 'admin';
/** 售后协商留言（顾客与商家在售后单内的双向沟通记录，Closed 后禁言） */
export declare class AfterSalesMessage extends VendureEntity {
    constructor(input?: DeepPartial<AfterSalesMessage>);
    request: AfterSalesRequest;
    requestId: number;
    senderType: AfterSalesMessageSenderType;
    /** 发送人 User 主键（系统路径可为 null） */
    senderUserId: number | null;
    /** 发送人显示名（顾客=Customer 姓名拼接 / 管理员=Administrator 姓名拼接） */
    senderName: string;
    /** 留言正文（≤1000 字，service 层校验） */
    content: string;
    /** 留言图片 URL（≤3 张，复用 uploadAfterSalesEvidence 返回的绝对 URL） */
    images: string[] | null;
    createdAt: Date;
    updatedAt: Date;
}
