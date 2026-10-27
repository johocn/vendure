import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 智能取餐柜站点（P2-4）：按渠道登记柜机，C 端只读展示柜机位置与取餐指引。
 *
 * 本轮为「接口占位」：不接柜机厂商 SDK，只落站点与格口规模，
 * 后续对接服务商时用 provider + 格口数据补「投柜 / 取柜」回调。
 */
export declare class CampusLockerStation extends VendureEntity {
    channelId: ID;
    /** 柜机名称（C 端列表主标题，如「东区 3 号楼智能柜」） */
    name: string;
    /** 柜机位置（如「东区 3 号楼一层大厅」） */
    location: string;
    /** 服务商编码：self=自建；其余见 unmanned-delivery.ts 的 UNMANNED_PROVIDERS */
    provider: string;
    /** 格口总数 */
    totalCells: number;
    /** 当前可用格口（运营手工维护，本轮不接实时库存） */
    availableCells: number;
    /** 开放时间（如 07:00-23:00；空 = 全天） */
    openHours: string | null;
    /** 取餐指引（C 端弹层展示，如「取餐码 6 位，柜机屏幕输入即可开柜」） */
    pickupGuide: string | null;
    /** C 端是否展示（停用后仅后台可见） */
    enabled: boolean;
    /** 排序（越小越靠前） */
    sort: number;
    createdBy: string | null;
    constructor(input?: DeepPartial<CampusLockerStation>);
}
