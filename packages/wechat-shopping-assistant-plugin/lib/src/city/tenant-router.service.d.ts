import { RequestContext } from '@vendure/core';
import { CityCatalogService } from './city-catalog.service';
import { Candidate } from './tenant-router';
export interface TenantRouteResult {
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
}
