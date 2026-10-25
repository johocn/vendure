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

    /** 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店） */
    async parse(ctx: RequestContext, addressText: string): Promise<ParsedAddress | null> {
        const geo = await this.geoService.geocode(ctx, addressText);
        if (!geo) {
            Logger.warn(`Delivery guard geocode failed: "${addressText.slice(0, 40)}"`, loggerCtx);
            return null;
        }
        return buildParsedAddress(geo, addressText);
    }

    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    async check(ctx: RequestContext, channelId: string, addressText: string): Promise<GuardResult> {
        const parsed = await this.parse(ctx, addressText);
        if (!parsed) return { status: 'UNKNOWN', serviceAreaText: '', parsed: null };
        return this.checkParsed(ctx, channelId, parsed);
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
            // 直辖市场景地图只回省份（city 为空），用省份兜底，避免向用户暴露城市码
            serviceAreaText: `本店目前不服务「${parsed.city || parsed.province || parsed.cityCode || '该'}」地区的地址。`,
            parsed,
        };
    }

    private servingCities(channel: Channel | null): string[] {
        const raw = (channel?.customFields as any)?.servingCities;
        return Array.isArray(raw) ? raw.map(String) : [];
    }
}
