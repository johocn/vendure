import { Injectable, Logger } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection } from '@vendure/core';

import { GeoService } from '../geo.service';
import { buildParsedAddress, ParsedAddress } from './address-parser';

const loggerCtx = 'WechatAssistantDeliveryGuard';

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
@Injectable()
export class DeliveryGuardService {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly geoService: GeoService,
    ) {}

    /**
     * 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店）。
     * coords 为地址簿已存坐标：地理编码超时/网络失败时用它逆地理取行政区，再补取区划码。
     */
    async parse(
        ctx: RequestContext,
        addressText: string,
        coords?: { lat: number; lng: number } | null,
    ): Promise<ParsedAddress | null> {
        const geo = await this.geoService.geocode(ctx, addressText);
        if (geo) return buildParsedAddress(geo, addressText);

        const fallback = await this.parseByCoordinates(ctx, addressText, coords);
        if (fallback) return fallback;
        Logger.warn(`Delivery guard geocode failed: "${addressText.slice(0, 40)}"`, loggerCtx);
        return null;
    }

    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    async check(
        ctx: RequestContext,
        channelId: string,
        addressText: string,
        coords?: { lat: number; lng: number } | null,
    ): Promise<GuardResult> {
        const parsed = await this.parse(ctx, addressText, coords);
        if (!parsed) return { status: 'UNKNOWN', serviceAreaText: '', parsed: null };
        return this.checkParsed(ctx, channelId, parsed);
    }

    /**
     * 坐标兜底：逆地理得到省/市/区文本，再用这段短文本取区划码（短文本命中快，规避长地址超时）。
     * 逆地理本身失败时返回 null，调用方仍按 fail closed 处理。
     */
    private async parseByCoordinates(
        ctx: RequestContext,
        addressText: string,
        coords?: { lat: number; lng: number } | null,
    ): Promise<ParsedAddress | null> {
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
        const reverse = await this.geoService.reverse(ctx, coords.lat, coords.lng);
        const admin = [reverse?.province, reverse?.city, reverse?.district].filter(Boolean).join('');
        if (admin.length < 2) return null;
        const geo = await this.geoService.geocode(ctx, admin);
        if (!geo) return null;
        Logger.log(`Delivery guard geocode fallback by coordinates: ${admin}`, loggerCtx);
        // 坐标以地址簿存值为准；格式化地址沿用用户填写的原文
        return buildParsedAddress(
            { ...geo, formattedAddress: addressText, lat: coords.lat, lng: coords.lng },
            addressText,
        );
    }

    /** 已解析地址的范围判定：地址城市码是否在渠道服务城市内 */
    async checkParsed(
        ctx: RequestContext,
        channelId: string,
        parsed: ParsedAddress,
    ): Promise<GuardResult> {
        // rawConnection：按显式 channelId 查，避免 ctx 通道过滤挡住跨租户校验
        const channel = await this.connection.rawConnection
            .getRepository(Channel)
            .findOne({ where: { id: Number(channelId) } });
        const servingCities = this.servingCities(channel);
        if (!servingCities.length) return { status: 'OK', serviceAreaText: '', parsed };
        if (parsed.cityCode && servingCities.includes(parsed.cityCode)) {
            return { status: 'OK', serviceAreaText: '', parsed };
        }
        Logger.log(
            `Delivery out of range: channel=${channelId} city=${parsed.cityCode ?? '-'}`,
            loggerCtx,
        );
        return {
            status: 'OUT_OF_RANGE',
            reason: 'CITY_NOT_SERVED',
            serviceAreaText: `本店目前不服务「${areaLabel(parsed)}」地区的地址。`,
            parsed,
        };
    }

    private servingCities(channel: Channel | null): string[] {
        const raw = (channel?.customFields as any)?.servingCities;
        return Array.isArray(raw) ? raw.map(String) : [];
    }
}

/**
 * 超范围文案的「地区」展示名：
 * 直辖市等高德只回区县或空省市时，从地址原文取「xx市/自治州/地区/盟」，
 * 避免向用户暴露城市码（110100）。
 */
function areaLabel(parsed: ParsedAddress): string {
    if (parsed.city) return parsed.city;
    if (parsed.province) return parsed.province;
    const m = /^(.{2,10}?(?:市|自治州|地区|盟))/.exec(parsed.streetLine1 || '');
    if (m) return m[1];
    return parsed.district || parsed.cityCode || '该';
}
