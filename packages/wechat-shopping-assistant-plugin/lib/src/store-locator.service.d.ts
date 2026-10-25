import { ModuleRef } from '@nestjs/core';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { NearbyStore } from './types';
/** 门店匹配半径（km） */
export declare const STORE_RADIUS_KM = 3;
/**
 * 门店匹配服务（购物助手专用）：
 * - 3km 内门店：取渠道可见的 store 类型自提点 → 坐标校验 → Haversine 距离过滤
 * - 熟店优先：顾客历史订单选过的门店排在 3km 内列表最前，其余按距离升序
 * 所有失败返回空列表，不向上抛错（聊天链路不因门店数据异常中断）。
 */
export declare class StoreLocatorService {
    private readonly moduleRef;
    private readonly connection;
    /** PickupLocationService 在根容器注册，跨模块懒解析并缓存 */
    private pickupService?;
    private warned;
    constructor(moduleRef: ModuleRef, connection: TransactionalConnection);
    private getPickupService;
    /** 3km 内门店（熟店优先，其次距离升序）；无门店/数据异常返回空列表 */
    findNearby(ctx: RequestContext, lat: number, lng: number, options?: {
        radiusKm?: number;
        familiarStoreIds?: Set<string>;
    }): Promise<NearbyStore[]>;
    /** 顾客历史订单选过的门店 id（按使用次数降序），用于「熟店优先」 */
    familiarStoreIds(ctx: RequestContext, customerId: string | number | null | undefined): Promise<Set<string>>;
}
