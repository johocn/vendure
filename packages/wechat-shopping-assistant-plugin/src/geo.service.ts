import { Injectable, Optional } from '@nestjs/common';
import { GeocodeInput, GeocodeResult, MapService } from '@vendure/cjk-plugin';
import { Logger, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';

/** 中国陆地经纬度范围（不含港澳台细化边界），用于挡掉 0,0 与境外坐标 */
const CHINA_BOUNDS = { minLat: 3.86, maxLat: 53.55, minLng: 73.66, maxLng: 135.09 };
const SUCCESS_TTL = 30 * 24 * 60 * 60_000;
const FAIL_TTL = 10 * 60_000;
const MAX_CACHE = 500;
/** 聊天链路 5 秒窗口：单次地理编码超时压到 1.2s，失败快速走降级/追问 */
const CHAT_TIMEOUT_MS = 1200;

interface CacheEntry<V> {
    /** null = 上次查询失败（短 TTL，避免同一坏输入反复打地图 API） */
    value: V | null;
    expiresAt: number;
}

export interface ReverseAddressResult {
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    formattedAddress: string;
}

/**
 * 地理编码服务（购物助手专用）：
 * - 正向：地址文本 → 坐标（带文本清洗、城市提示、多候选降级、进程内缓存）
 * - 逆向：微信位置坐标 → 省市区 + 格式化地址
 * - 坐标守卫：仅接受中国范围内有效坐标
 * 所有方法失败返回 null，不向上抛错（聊天链路不因地图服务异常中断）。
 */
@Injectable()
export class GeoService {
    private geocodeCache = new Map<string, CacheEntry<GeocodeResult>>();
    private reverseCache = new Map<string, CacheEntry<ReverseAddressResult>>();

    constructor(@Optional() private mapService?: MapService) {}

    /** 坐标是否可用：有限数值、非 0,0、在中国范围内 */
    static isValidCoordinate(lat: number, lng: number): boolean {
        return (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            !(lat === 0 && lng === 0) &&
            lat >= CHINA_BOUNDS.minLat &&
            lat <= CHINA_BOUNDS.maxLat &&
            lng >= CHINA_BOUNDS.minLng &&
            lng <= CHINA_BOUNDS.maxLng
        );
    }

    /** 逆向结果拼成一句话地址；优先地图格式化地址，缺失时用省市区 + 用户上报描述兜底 */
    static composeAddressText(reverse: ReverseAddressResult | null, label?: string): string {
        const formatted = (reverse?.formattedAddress ?? '').trim();
        if (formatted.length >= 8) return formatted;
        const joined = [reverse?.province, reverse?.city, reverse?.district, reverse?.street, label]
            .filter((v): v is string => !!v && v.length > 0)
            .join('');
        return joined || (label ?? '').trim();
    }

    /** 地址文本 → 坐标；失败返回 null */
    async geocode(
        ctx: RequestContext,
        address: string | null | undefined,
        hint?: { city?: string | null; district?: string | null },
    ): Promise<GeocodeResult | null> {
        const text = normalizeAddressText(address);
        if (!text || text.length < 6 || !this.mapService) return null;
        const cityHint = hint?.city?.trim() || undefined;
        const key = `g:${cityHint ?? ''}|${text}`;
        const cached = this.readCache(this.geocodeCache, key);
        if (cached !== undefined) return cached;

        let lastError: unknown;
        for (const candidate of buildCandidates(text, cityHint)) {
            try {
                const result = await this.mapService.geocode(ctx, candidate, CHAT_TIMEOUT_MS);
                if (result && GeoService.isValidCoordinate(result.lat, result.lng)) {
                    this.writeCache(this.geocodeCache, key, result, SUCCESS_TTL);
                    return result;
                }
            } catch (e) {
                lastError = e;
            }
        }
        this.writeCache(this.geocodeCache, key, null, FAIL_TTL);
        Logger.warn(
            `Assistant geocode failed: "${text.slice(0, 40)}" ${lastError ? String(lastError) : ''}`,
            loggerCtx,
        );
        return null;
    }

    /** 微信位置坐标 → 结构化地址；失败返回 null */
    async reverse(ctx: RequestContext, lat: number, lng: number): Promise<ReverseAddressResult | null> {
        if (!this.mapService || !GeoService.isValidCoordinate(lat, lng)) return null;
        // 约 11m 精度取整，避免同一点重复请求
        const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
        const cached = this.readCache(this.reverseCache, key);
        if (cached !== undefined) return cached;
        try {
            const result = await this.mapService.reverseGeocode(ctx, lat, lng);
            if (!result) return null;
            this.writeCache(this.reverseCache, key, result, SUCCESS_TTL);
            return result;
        } catch (e) {
            Logger.warn(`Assistant reverse geocode failed: ${String(e)}`, loggerCtx);
            this.writeCache(this.reverseCache, key, null, FAIL_TTL);
            return null;
        }
    }

    private readCache<V>(cache: Map<string, CacheEntry<V>>, key: string): V | null | undefined {
        const hit = cache.get(key);
        if (!hit) return undefined;
        if (hit.expiresAt < Date.now()) {
            cache.delete(key);
            return undefined;
        }
        return hit.value;
    }

    private writeCache<V>(cache: Map<string, CacheEntry<V>>, key: string, value: V | null, ttlMs: number): void {
        if (cache.size >= MAX_CACHE) {
            // Map 按插入顺序迭代：删最旧一条
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
}

/** 地址文本清洗：去首尾空白、压缩连续空白、去常见备注括号 */
function normalizeAddressText(address: string | null | undefined): string {
    const raw = String(address ?? '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    return raw.replace(/[（(][^（）()]*[）)]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 编码候选降级链：完整地址（带城市限定）→ 去备注主干 → 长文本截取到区/路级别。
 * 地图 API 对超长/夹带备注的地址命中率明显下降，逐级回退提升成功率。
 */
function buildCandidates(text: string, city?: string): GeocodeInput[] {
    const seen = new Set<string>();
    const candidates: GeocodeInput[] = [];
    const push = (address: string, cityHint?: string) => {
        const value = address.trim();
        if (!value) return;
        const key = `${cityHint ?? ''}|${value}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ address: value, city: cityHint });
    };
    push(text, city);
    if (text.length > 30) push(text.slice(0, 30), city);
    push(text, undefined);
    return candidates;
}
