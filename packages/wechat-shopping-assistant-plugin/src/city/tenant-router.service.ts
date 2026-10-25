import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';

import { CityCatalogService } from './city-catalog.service';
import { Candidate, rankCandidates } from './tenant-router';

export interface TenantRouteResult {
    chosen: Candidate | null;
    candidates: Candidate[];
    ambiguous: boolean;
    /** 当前渠道是否仍在候选内（false 表示需要切店重搜） */
    currentInCandidates: boolean;
}

@Injectable()
export class TenantRouterService {
    constructor(private readonly catalog: CityCatalogService) {}

    async resolve(
        ctx: RequestContext,
        input: { cityCode?: string | null; currentChannelId?: string | null; lat?: number | null; lng?: number | null },
    ): Promise<TenantRouteResult> {
        const index = await this.catalog.getIndex(ctx);
        const cityHits = input.cityCode ? (index.byCity.get(input.cityCode) ?? []) : [];
        // 半径渠道：用户坐标 + 圆心坐标都齐全才计算距离；缺圆心则 distanceKm 保持 null，
        // 被 rankCandidates 过滤掉（不猜，交由 delivery-guard 明确拒绝）
        const others = index.allChannels.map(c => {
            if (c.precision !== 'circle') return c;
            if (input.lat == null || input.lng == null || c.centerLat == null || c.centerLng == null) return c;
            return { ...c, distanceKm: haversineKm(input.lat, input.lng, c.centerLat, c.centerLng) };
        });
        const candidates = rankCandidates([...cityHits, ...others]).slice(0, 3);
        const currentChannelId = String(input.currentChannelId ?? '');
        return {
            chosen: candidates[0] ?? null,
            candidates,
            ambiguous: candidates.length > 1 && candidates[0].precision === candidates[1].precision,
            currentInCandidates: candidates.some(c => c.channelId === currentChannelId),
        };
    }
}

/** 两点球面距离（km），保留 2 位小数 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;
}
