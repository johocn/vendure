import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/**
 * 智能取餐柜站点（P2-4）：按渠道登记柜机，C 端只读展示柜机位置与取餐指引。
 *
 * 本轮为「接口占位」：不接柜机厂商 SDK，只落站点与格口规模，
 * 后续对接服务商时用 provider + 格口数据补「投柜 / 取柜」回调。
 */
@Entity()
@Index('idx_campus_locker_channel', ['channelId', 'enabled'])
export class CampusLockerStation extends VendureEntity {
    @Column('int') channelId: ID;
    /** 柜机名称（C 端列表主标题，如「东区 3 号楼智能柜」） */
    @Column({ type: 'varchar', length: 64 }) name: string;
    /** 柜机位置（如「东区 3 号楼一层大厅」） */
    @Column({ type: 'varchar', length: 255 }) location: string;
    /** 服务商编码：self=自建；其余见 unmanned-delivery.ts 的 UNMANNED_PROVIDERS */
    @Column({ type: 'varchar', length: 32, default: 'self' }) provider: string;
    /** 格口总数 */
    @Column({ type: 'int', default: 0 }) totalCells: number;
    /** 当前可用格口（运营手工维护，本轮不接实时库存） */
    @Column({ type: 'int', default: 0 }) availableCells: number;
    /** 开放时间（如 07:00-23:00；空 = 全天） */
    @Column({ type: 'varchar', length: 32, nullable: true }) openHours: string | null;
    /** 取餐指引（C 端弹层展示，如「取餐码 6 位，柜机屏幕输入即可开柜」） */
    @Column({ type: 'text', nullable: true }) pickupGuide: string | null;
    /** C 端是否展示（停用后仅后台可见） */
    @Column({ default: true }) enabled: boolean;
    /** 排序（越小越靠前） */
    @Column({ type: 'int', default: 0 }) sort: number;
    @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null;
    constructor(input?: DeepPartial<CampusLockerStation>) {
        super(input);
    }
}
