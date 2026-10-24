import { Order, OrderService, RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { DeliverySlot } from './delivery-slot.entity';
export declare class CampusConfigService {
    private dataSource;
    private orderService;
    constructor(dataSource: DataSource, orderService: OrderService);
    listZones(ctx: RequestContext): Promise<CampusZone[]>;
    createZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    /** 分区改名/改运费（渠道隔离）；分区名被历史订单快照引用，仅改当前配置不影响已下单 */
    updateZone(ctx: RequestContext, id: number, patch: {
        name?: string;
        fee?: number;
    }): Promise<CampusZone>;
    /** 删除楼栋：仅当无订单引用（含历史指向该楼栋的订单）时允许，避免配送目标丢失 */
    deleteBuilding(ctx: RequestContext, id: number): Promise<boolean>;
    /** 楼栋按当前渠道隔离：后台维护页与 C 端选楼都只读本渠道数据 */
    listBuildings(ctx: RequestContext, zoneId?: number): Promise<CampusBuilding[]>;
    createBuilding(ctx: RequestContext, name: string, zoneId: number, detail?: string, lat?: number, lng?: number): Promise<any>;
    /** 楼栋信息/坐标维护（骑手跟踪页目标点）；仅更新传入字段 */
    updateBuilding(ctx: RequestContext, id: number, patch: {
        name?: string;
        detail?: string;
        lat?: number | null;
        lng?: number | null;
    }): Promise<CampusBuilding>;
    getConfig(ctx: RequestContext): Promise<CampusFulfillmentConfig>;
    /** 允许后台写入的字段白名单：不含 channelId/id/createdAt 等身份列，
     * 防止渠道管理员通过 patch 注入主键或跨渠道绑定（resolver 入参为 any，服务层必须自守）。 */
    private static readonly WRITABLE_FIELDS;
    /** 整型配置的取值范围（分钟/百分比/分） */
    private static readonly INT_RANGES;
    updateConfig(ctx: RequestContext, patch: Partial<CampusFulfillmentConfig>): Promise<CampusFulfillmentConfig>;
    createSlot(ctx: RequestContext, input: {
        slotDate: string;
        startTime: string;
        endTime: string;
        zoneId?: number;
        capacity?: number;
    }): Promise<any>;
    updateSlot(ctx: RequestContext, id: number, patch: {
        capacity?: number;
        active?: boolean;
        startTime?: string;
        endTime?: string;
    }): Promise<DeliverySlot>;
    listSlots(ctx: RequestContext): Promise<DeliverySlot[]>;
    /** C 端可订时段：active 且未过期，带余量 */
    slotsForShop(ctx: RequestContext): Promise<{
        remaining: number;
        slotDate: string;
        startTime: string;
        endTime: string;
        zoneId: import("@vendure/core").ID;
        capacity: number;
        lockedCount: number;
        active: boolean;
        channelId: import("@vendure/core").ID;
        id: import("@vendure/core").ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /** C 端选楼/选区/选路线/选时段写入 activeOrder。
     * route/slot 可选（向后兼容 plan2 旧调用形态）；route 为 R1/R2/R3；R2 的到校确认走 r2-mark 链路。 */
    setDeliveryTarget(ctx: RequestContext, zoneId: number, buildingId: number, route?: 'R1' | 'R2' | 'R3', slotId?: number): Promise<Order>;
}
