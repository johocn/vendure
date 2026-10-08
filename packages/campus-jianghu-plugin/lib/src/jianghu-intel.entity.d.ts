import { Customer, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 情报集市条目（方向二）。仅承载公开信息；sourceNote 必填，合规留痕。
 * 审核通过 (APPROVED) 才上架；违规内容 REJECTED。
 */
export declare class JianghuIntel extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuIntel>);
    category: 'FOOD' | 'CLASSROOM' | 'CLUB' | 'EVENT' | 'NOTICE' | 'SCENERY';
    campusCode: string | null;
    /** 打码标题 */
    summary: string;
    /** 解锁后可见正文 */
    content: string | null;
    /** 信息来源（必填） */
    sourceNote: string;
    priceIntel: number;
    viewCount: number;
    authorCustomerId: number | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    author?: Customer;
}
