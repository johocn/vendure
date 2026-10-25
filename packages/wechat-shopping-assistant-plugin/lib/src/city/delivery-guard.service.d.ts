import { RequestContext, TransactionalConnection } from '@vendure/core';
import { GeoService } from '../geo.service';
import { ParsedAddress } from './address-parser';
export type GuardStatus = 'OK' | 'OUT_OF_RANGE' | 'UNKNOWN';
export interface GuardResult {
    status: GuardStatus;
    reason?: string;
    serviceAreaText: string;
    parsed: ParsedAddress | null;
}
/**
 * 配送守卫：地址解析 + 城市级范围判定。
 * 判定依据为渠道 `servingCities`（服务城市码）；未配置的渠道视为不限（线上历史渠道均未配置）。
 */
export declare class DeliveryGuardService {
    private readonly connection;
    private readonly geoService;
    constructor(connection: TransactionalConnection, geoService: GeoService);
    /** 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店） */
    parse(ctx: RequestContext, addressText: string): Promise<ParsedAddress | null>;
    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    check(ctx: RequestContext, channelId: string, addressText: string): Promise<GuardResult>;
    /** 已解析地址的范围判定：地址城市码是否在渠道服务城市内 */
    checkParsed(ctx: RequestContext, channelId: string, parsed: ParsedAddress): Promise<GuardResult>;
    private servingCities;
}
