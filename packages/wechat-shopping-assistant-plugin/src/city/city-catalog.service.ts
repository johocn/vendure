import { Injectable, Logger } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryRange } from '@vendure/address-plugin';

import { buildCityIndex, CityIndex, ChannelLike, RangeLike } from './city-catalog';

const loggerCtx = 'WechatAssistantCityCatalog';
const CACHE_TTL_MS = 5 * 60_000;

@Injectable()
export class CityCatalogService {
    private cache: { index: CityIndex; expiresAt: number } | null = null;

    constructor(private readonly connection: TransactionalConnection) {}

    async getIndex(ctx: RequestContext): Promise<CityIndex> {
        if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.index;
        // 用 rawConnection 绕过 ChannelAware 过滤：目录需要跨渠道全量（ctx 通道过滤会漏掉其他租户）
        const [channels, ranges] = await Promise.all([
            this.connection.rawConnection.getRepository(Channel).find(),
            this.connection.rawConnection.getRepository(DeliveryRange).find(),
        ]);
        const channelLikes: ChannelLike[] = channels.map(ch => {
            const cf = (ch.customFields ?? {}) as any;
            return {
                id: String(ch.id),
                code: ch.code,
                token: ch.token,
                name: String(cf.shopName ?? ch.code),
                servingCities: Array.isArray(cf.servingCities) ? cf.servingCities.map(String) : [],
                minOrderAmount: Number(cf.minOrderAmount ?? 0) || 0,
                deliveryMinutes: cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null,
            };
        });
        const rangeLikes = ranges.map(r => ({
            channelId: String((r as any).channelId),
            shopId: String((r as any).shopId),
            rangeType: String((r as any).rangeType),
            districtCodes: (r as any).districtCodes ?? null,
            radiusKm: (r as any).radiusKm ?? null,
            centerLat: (r as any).centerLat ?? null,
            centerLng: (r as any).centerLng ?? null,
            enabled: Boolean((r as any).enabled),
        })) as RangeLike[];
        const index = buildCityIndex(channelLikes, rangeLikes);
        this.cache = { index, expiresAt: Date.now() + CACHE_TTL_MS };
        Logger.log(
            `City catalog built: cities=${index.byCity.size} all=${index.allChannels.length}`,
            loggerCtx,
        );
        return index;
    }

    /** 渠道字段变更后立即失效（后台保存时调用） */
    invalidate(): void {
        this.cache = null;
    }
}
