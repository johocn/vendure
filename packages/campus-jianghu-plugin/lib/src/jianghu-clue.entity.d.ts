import { DeepPartial, VendureEntity } from '@vendure/core';
/** 线索审核状态：PENDING 待审（提交后默认，不上墙不计数）/ SHOWN 已上墙 / REJECTED 已下线 */
export declare const ClueStatus: {
    readonly PENDING: "PENDING";
    readonly SHOWN: "SHOWN";
    readonly REJECTED: "REJECTED";
};
export type ClueStatusType = (typeof ClueStatus)[keyof typeof ClueStatus];
/**
 * 江湖事件线索（方向三 P2 多人拼图碎片）。
 * 一条线索由某传信者提交，计入事件 collected（点亮一块拼图）；内容公开可见，
 * 来源必填（合规留痕）。提交后默认为 PENDING，经运营审核通过(SHOWN)才上墙并计入进度，
 * 下线(REJECTED)则回收进度。
 */
export declare class JianghuClue extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuClue>);
    eventId: string;
    customerId: string;
    nickname?: string;
    content: string;
    /** 信息来源（必填，合规留痕，与情报/传闻一致） */
    sourceNote: string;
    campusCode?: string;
    likes: number;
    status: string;
}
