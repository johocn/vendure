import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PickupLocationService } from '@vendure/cjk-plugin';
import { Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { NearbyStore } from './types';

/** 门店匹配半径（km） */
export const STORE_RADIUS_KM = 3;
/** 门店列表最多展示条数 */
const MAX_STORES = 5;
/** 熟店取历史使用次数前 N 家 */
const FAMILIAR_LIMIT = 5;

/**
 * 门店匹配服务（购物助手专用）：
 * - 3km 内门店：取渠道可见的 store 类型自提点 → 坐标校验 → Haversine 距离过滤
 * - 熟店优先：顾客历史订单选过的门店排在 3km 内列表最前，其余按距离升序
 * 所有失败返回空列表，不向上抛错（聊天链路不因门店数据异常中断）。
 */
@Injectable()
export class StoreLocatorService {
    /** PickupLocationService 在根容器注册，跨模块懒解析并缓存 */
    private pickupService?: PickupLocationService;
    private warned = false;

    constructor(
        private readonly moduleRef: ModuleRef,
        private readonly connection: TransactionalConnection,
    ) {}

    private getPickupService(): PickupLocationService | undefined {
        if (this.pickupService) return this.pickupService;
        try {
            this.pickupService = this.moduleRef.get(PickupLocationService, { strict: false });
            return this.pickupService;
        } catch (e) {
            if (!this.warned) {
                this.warned = true;
                Logger.warn(`PickupLocationService 不可用，门店匹配降级：${String(e)}`, loggerCtx);
            }
            return undefined;
        }
    }

    /** 3km 内门店（熟店优先，其次距离升序）；无门店/数据异常返回空列表 */
    async findNearby(
        ctx: RequestContext,
        lat: number,
        lng: number,
        options: { radiusKm?: number; familiarStoreIds?: Set<string> } = {},
    ): Promise<NearbyStore[]> {
        const service = this.getPickupService();
        if (!service) return [];
        const radius = options.radiusKm ?? STORE_RADIUS_KM;
        const familiar = options.familiarStoreIds ?? new Set<string>();

        let locations: Awaited<ReturnType<PickupLocationService['findByType']>>;
        try {
            locations = await service.findByType(ctx, 'store');
        } catch (e) {
            Logger.warn(`Assistant store list failed: ${String(e)}`, loggerCtx);
            return [];
        }

        return locations
            .filter(l => l.coordinates && isFiniteNumber(l.coordinates.lat) && isFiniteNumber(l.coordinates.lng))
            .map(l => ({
                id: String(l.id),
                name: l.name,
                address: l.address ?? '',
                distanceKm: roundKm(haversineKm(lat, lng, Number(l.coordinates!.lat), Number(l.coordinates!.lng))),
                familiar: familiar.has(String(l.id)),
            }))
            .filter(store => store.distanceKm <= radius)
            .sort((a, b) => Number(b.familiar) - Number(a.familiar) || a.distanceKm - b.distanceKm)
            .slice(0, MAX_STORES);
    }

    /** 顾客历史订单选过的门店 id（按使用次数降序），用于「熟店优先」 */
    async familiarStoreIds(ctx: RequestContext, customerId: string | number | null | undefined): Promise<Set<string>> {
        if (!customerId) return new Set();
        try {
            // relation 自定义字段（selectedPickupLocationId）不随实体加载，用 join 读取 id
            const rows = await this.connection
                .getRepository(ctx, Order)
                .createQueryBuilder('o')
                .leftJoin('o.customFields.selectedPickupLocationId', 'pl')
                .select('pl.id', 'storeId')
                .addSelect('COUNT(o.id)', 'cnt')
                .where('o.customerId = :customerId', { customerId: String(customerId) })
                .andWhere('pl.id IS NOT NULL')
                .groupBy('pl.id')
                .orderBy('cnt', 'DESC')
                .limit(FAMILIAR_LIMIT)
                .getRawMany<{ storeId: string | number }>();
            return new Set(rows.map(row => String(row.storeId)));
        } catch (e) {
            Logger.warn(`Assistant familiar store query failed: ${String(e)}`, loggerCtx);
            return new Set();
        }
    }
}

function isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function roundKm(value: number): number {
    return Math.round(value * 10) / 10;
}

/** Haversine 直线距离（km） */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
