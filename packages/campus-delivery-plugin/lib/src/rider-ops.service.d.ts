import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusRiderReview, CampusRiderShift } from './rider-ops.entities';
/**
 * 骑手运营域：排班、在线会话/在线时长、用户评分、配送导航坐标。
 * 会话由 RiderService（上下线/心跳）写入，运力预警 job 关闭超时会话。
 */
export declare class RiderOpsService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    private requireCustomer;
    /** 上线开新会话（已有进行中会话则只续心跳）；下线关闭会话并落分钟数 */
    touchSession(ctx: RequestContext, riderCustomerId: number, online: boolean): Promise<void>;
    /** 心跳：无进行中会话时补开（历史在线骑手跨版本升级后仍能计入时长） */
    heartbeatSession(ctx: RequestContext, riderCustomerId: number): Promise<void>;
    /** 按日统计在线时长（分钟）：会话与当日窗口取交集 */
    onlineStats(ctx: RequestContext, date?: string): Promise<{
        date: string;
        items: {
            riderCustomerId: number;
            realName: any;
            onlineMinutes: number;
        }[];
    }>;
    saveShift(ctx: RequestContext, input: {
        id?: ID | null;
        riderCustomerId: ID;
        shiftDate: string;
        startTime: string;
        endTime: string;
        note?: string | null;
    }): Promise<any>;
    deleteShift(ctx: RequestContext, id: ID): Promise<{
        ok: boolean;
    }>;
    listShifts(ctx: RequestContext, date: string): Promise<{
        date: string;
        items: {
            realName: any;
            onlineMinutes: number;
            shiftMinutes: number;
            channelId: ID;
            riderCustomerId: ID;
            shiftDate: string;
            startTime: string;
            endTime: string;
            note: string | null;
            id: ID;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    /** 骑手端：我的班次（日期区间） */
    myShifts(ctx: RequestContext, from?: string, to?: string): Promise<CampusRiderShift[]>;
    createReview(ctx: RequestContext, orderId: ID, rating: number, tags?: string[] | null, comment?: string | null): Promise<any>;
    /** 评分汇总：不传 riderCustomerId = 当前登录骑手自己 */
    ratingStats(ctx: RequestContext, riderCustomerId?: ID | null): Promise<{
        riderCustomerId: number;
        avgRating: number;
        ratingCount: number;
    }>;
    adminReviews(ctx: RequestContext, riderCustomerId?: ID | null, skip?: number, take?: number): Promise<CampusRiderReview[]>;
    /** 骑手配送导航：店铺取货点 + 收货楼栋坐标（gcj02），供 uni.openLocation 使用 */
    riderNav(ctx: RequestContext, orderId: ID): Promise<{
        orderId: ID;
        orderCode: string;
        storeName: string;
        storeAddress: string | null;
        storePhone: string | null;
        storeLat: number | null;
        storeLng: number | null;
        buildingName: string | null;
        buildingDetail: any;
        buildingLat: number | null;
        buildingLng: number | null;
        campusZone: any;
        note: any;
        deliveryStatus: any;
    }>;
}
