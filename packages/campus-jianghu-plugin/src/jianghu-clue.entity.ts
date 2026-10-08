import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/** 线索审核状态：PENDING 待审（提交后默认，不上墙不计数）/ SHOWN 已上墙 / REJECTED 已下线 */
export const ClueStatus = {
    PENDING: 'PENDING',
    SHOWN: 'SHOWN',
    REJECTED: 'REJECTED',
} as const;
export type ClueStatusType = (typeof ClueStatus)[keyof typeof ClueStatus];

/**
 * 江湖事件线索（方向三 P2 多人拼图碎片）。
 * 一条线索由某传信者提交，计入事件 collected（点亮一块拼图）；内容公开可见，
 * 来源必填（合规留痕）。提交后默认为 PENDING，经运营审核通过(SHOWN)才上墙并计入进度，
 * 下线(REJECTED)则回收进度。
 */
@Entity('jianghu_clue')
export class JianghuClue extends VendureEntity {
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuClue>) {
        super(input);
    }

    @Column() eventId: string;
    @Column() customerId: string;
    @Column({ type: 'varchar', nullable: true }) nickname?: string;
    @Column('text') content: string;
    /** 信息来源（必填，合规留痕，与情报/传闻一致） */
    @Column({ type: 'varchar' }) sourceNote: string;
    @Column({ type: 'varchar', nullable: true }) campusCode?: string;
    @Column('int', { default: 0 }) likes: number;
    @Column({ type: 'varchar', default: ClueStatus.PENDING }) status: string;
}
