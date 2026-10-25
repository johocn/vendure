import { RequestContext } from '@vendure/core';
import { CityCatalogService } from './city-catalog.service';
import { Candidate } from './tenant-router';
export interface TenantRouteResult {
    /** 需要切店的目标渠道；null 表示保持当前渠道（含同精度、无候选、当前渠道更高精度） */
    chosen: Candidate | null;
    candidates: Candidate[];
    ambiguous: boolean;
    /** 当前渠道是否仍在候选内（false 表示需要切店重搜） */
    currentInCandidates: boolean;
}
export declare class TenantRouterService {
    private readonly catalog;
    constructor(catalog: CityCatalogService);
    resolve(ctx: RequestContext, input: {
        cityCode?: string | null;
        currentChannelId?: string | null;
        lat?: number | null;
        lng?: number | null;
    }): Promise<TenantRouteResult>;
    /**
     * 当前渠道的精度：未配置 servingCities → all；配置了但本城市不命中 → explicit
     * （配置过的渠道不参与 allChannels 兜底）；渠道不存在 → all（放行，不误切）。
     */
    private currentPrecision;
}
