import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryRange, DeliveryService } from '@vendure/address-plugin';

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

@Injectable()
export class DeliveryGuardService {
    constructor(
        private readonly deliveryService: DeliveryService,
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

    /** 已解析地址的范围判定：读该渠道配送档 → DeliveryService 判 rangeType */
    async checkParsed(
        ctx: RequestContext,
        channelId: string,
        parsed: ParsedAddress,
    ): Promise<GuardResult> {
        // rawConnection：按显式 channelId 查，避免 ctx 通道过滤挡住跨租户校验
        const range = await this.connection.rawConnection
            .getRepository(DeliveryRange)
            .findOne({ where: { channelId: Number(channelId), enabled: true } as any });
        if (!range) {
            return {
                status: 'OUT_OF_RANGE',
                reason: 'NO_DELIVERY',
                serviceAreaText: '该店铺暂未开通配送，回复「客服」可咨询。',
                parsed,
            };
        }
        const [result] = await this.deliveryService.validateDelivery(
            ctx,
            {
                fullName: '',
                phone: parsed.phoneNumber ?? '',
                provinceCode: parsed.provinceCode,
                cityCode: parsed.cityCode,
                districtCode: parsed.districtCode,
                detail: parsed.streetLine1,
                lat: parsed.lat,
                lng: parsed.lng,
            },
            [String(range.shopId)],
        );
        if (result?.inRange) return { status: 'OK', serviceAreaText: '', parsed };
        Logger.log(`Delivery out of range: channel=${channelId} reason=${result?.reason}`, loggerCtx);
        return {
            status: 'OUT_OF_RANGE',
            reason: result?.reason,
            serviceAreaText: this.describeArea(range),
            parsed,
        };
    }

    private describeArea(range: any): string {
        if (!range) return '该店铺暂未开通配送。';
        if (range.rangeType === 'circle') {
            return `本店配送范围为以门店为中心 ${range.radiusKm ?? 0} 公里内。`;
        }
        if (range.rangeType === 'district') {
            return '本店目前仅服务指定区县，回复「客服」可查询具体配送区域。';
        }
        return '本店配送范围以门店确认为准，回复「客服」可查询。';
    }
}
