import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { RiderEarning } from './rider-earning.entity';
import { RiderCreditService } from './rider-credit.service';
import { RiderService } from './rider.service';
export declare class OrderDeliveryShopResolver {
    /** 订单配送卡：直接读下单快照，避免在途单被后台配置变更影响 */
    campusOrderDelivery(order: Order): {
        deliveryPlan: any;
        handoverMode: any;
        provider: any;
        thirdPartyNo: any;
        state: any;
        courierName: any;
        courierPhone: any;
        handoverPointName: any;
        handoverPointAddress: any;
        handoverAt: any;
    } | null;
}
export declare class HallShopResolver {
    private grab;
    private config;
    private riderService;
    private connection;
    private hall;
    private credit;
    constructor(grab: HallGrabService, config: CampusConfigService, riderService: RiderService, connection: TransactionalConnection, hall: HallService, credit: RiderCreditService);
    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    campusGrabOrder(ctx: RequestContext, orderId: ID): Promise<Order>;
    /** 拒单：仅限被指派且未取货的骑手；订单回大厅 + 骑手扣分。 */
    campusRejectAssignment(ctx: RequestContext, orderId: ID): Promise<{
        backToHall: boolean;
    }>;
    private rejectAssignment;
    campusHall(ctx: RequestContext): Promise<Order[]>;
    /** F5 聚合大厅：一次带回全渠道 open 单（骑手端轮询从 N+1 请求降为 1 请求） */
    campusHallAll(ctx: RequestContext): Promise<{
        id: ID;
        code: string;
        total: number;
        shipping: number;
        createdAt: Date;
        channelId: string;
        channelToken: string;
        channelName: string;
        customFields: any;
    }[]>;
    /** 公开只读：选时段前预检余量 */
    campusShopSlots(ctx: RequestContext): Promise<{
        remaining: number;
        slotDate: string;
        startTime: string;
        endTime: string;
        zoneId: ID;
        capacity: number;
        lockedCount: number;
        active: boolean;
        channelId: ID;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /** 写 activeOrder 的配送目标（分区/楼栋/路线/时段）：按 Owner 校验，游客会话同样可用 */
    campusSetDeliveryTarget(ctx: RequestContext, zoneId: ID, buildingId: ID, route?: 'R1' | 'R2' | 'R3', slotId?: number): Promise<Order>;
    myRiderEarnings(ctx: RequestContext, skip?: number, take?: number): Promise<RiderEarning[]>;
}
