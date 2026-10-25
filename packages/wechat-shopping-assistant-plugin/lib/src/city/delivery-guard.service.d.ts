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
    /**
     * 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店）。
     * coords 为地址簿已存坐标：地理编码超时/网络失败时用它逆地理取行政区，再补取区划码。
     */
    parse(ctx: RequestContext, addressText: string, coords?: {
        lat: number;
        lng: number;
    } | null): Promise<ParsedAddress | null>;
    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    check(ctx: RequestContext, channelId: string, addressText: string, coords?: {
        lat: number;
        lng: number;
    } | null): Promise<GuardResult>;
    /**
     * 坐标兜底：逆地理得到省/市/区文本，再用这段短文本取区划码（短文本命中快，规避长地址超时）。
     * 逆地理本身失败时返回 null，调用方仍按 fail closed 处理。
     */
    private parseByCoordinates;
    /** 已解析地址的范围判定：地址城市码是否在渠道服务城市内 */
    checkParsed(ctx: RequestContext, channelId: string, parsed: ParsedAddress): Promise<GuardResult>;
    private servingCities;
}
