import { Injectable } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import crypto from 'crypto';

import { loggerCtx } from './constants';
import { CarrierDetectResult, TrackingResult, TrackingTrace } from './types';

@Injectable()
export class LogisticsQueryService {
    private cache = new Map<string, { data: any; expires: number }>();

    constructor(private channelService: ChannelService) {}

    async queryTracking(
        ctx: RequestContext,
        carrierCode: string,
        trackingNumber: string,
    ): Promise<TrackingResult> {
        const { customer, key } = await this.getApiConfig(ctx);

        const cacheKey = `${carrierCode}:${trackingNumber}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const param = JSON.stringify({
            com: carrierCode,
            num: trackingNumber,
        });
        const sign = crypto
            .createHash('md5')
            .update(param + key + customer)
            .digest('hex')
            .toUpperCase();

        const response = await fetch('https://poll.kuaidi100.com/poll/query.do', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `customer=${customer}&sign=${sign}&param=${encodeURIComponent(param)}`,
        });

        const data = await response.json() as any;

        const traces: TrackingTrace[] = (data.data ?? []).map((item: any) => ({
            time: item.ftime || item.time,
            status: item.status || '',
            description: item.context || '',
        }));

        const result: TrackingResult = {
            carrierCode: data.com || carrierCode,
            trackingNumber: data.nu || trackingNumber,
            traces,
        };

        this.setToCache(cacheKey, result);
        return result;
    }

    async detectCarrier(
        ctx: RequestContext,
        trackingNumber: string,
    ): Promise<CarrierDetectResult[]> {
        const { key } = await this.getApiConfig(ctx);

        const response = await fetch(
            `https://auto.kuaidi100.com/autonumber/auto?num=${trackingNumber}&key=${key}`,
        );
        const data = await response.json() as any[];
        return (data ?? []).map((item: any) => ({
            code: item.comCode,
            name: item.comCode,
        }));
    }

    private async getApiConfig(ctx: RequestContext): Promise<{ customer: string; key: string }> {
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const ccf = (channel as any)?.customFields;
        return {
            customer: ccf?.kuaidi100Customer || '',
            key: ccf?.kuaidi100Key || '',
        };
    }

    private getFromCache(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private setToCache(key: string, data: any, ttlMinutes: number = 30): void {
        this.cache.set(key, {
            data,
            expires: Date.now() + ttlMinutes * 60 * 1000,
        });
    }
}
