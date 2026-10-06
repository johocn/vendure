import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { HallService } from './hall.service';
export interface MerchantBoardLine {
    name: string;
    quantity: number;
    price: number;
}
export interface MerchantBoardOrder {
    id: string;
    code: string;
    createdAt: Date;
    total: number;
    building: string;
    zone: string;
    slotText: string;
    route: string;
    riderName: string | null;
    lines: MerchantBoardLine[];
}
export interface MerchantBoard {
    paused: boolean;
    merchantConfirmEnabled: boolean;
    pending: MerchantBoardOrder[];
    cooking: MerchantBoardOrder[];
    awaitingRider: MerchantBoardOrder[];
    delivering: MerchantBoardOrder[];
    completedToday: number;
    completedTodayAmount: number;
}
/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
export declare class MerchantAdminService {
    private connection;
    private config;
    private hall;
    private notify;
    constructor(connection: TransactionalConnection, config: CampusConfigService, hall: HallService, notify: CampusNotifyService);
    board(ctx: RequestContext): Promise<MerchantBoard>;
    /** 商家接单确认：pending_merchant → accepted */
    acceptOrder(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 出餐完成：accepted → open 入大厅（hallEnteredAt 重置，骑手侧调度计时从此起算） */
    cookingDone(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    setPaused(ctx: RequestContext, paused: boolean): Promise<{
        ok: boolean;
    }>;
    private assertChannelOrder;
    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private toDto;
}
