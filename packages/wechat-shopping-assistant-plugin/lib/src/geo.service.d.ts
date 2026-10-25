import { GeocodeResult, MapService } from '@vendure/cjk-plugin';
import { RequestContext } from '@vendure/core';
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
export declare class GeoService {
    private mapService?;
    private geocodeCache;
    private reverseCache;
    constructor(mapService?: MapService | undefined);
    /** 坐标是否可用：有限数值、非 0,0、在中国范围内 */
    static isValidCoordinate(lat: number, lng: number): boolean;
    /** 逆向结果拼成一句话地址；优先地图格式化地址，缺失时用省市区 + 用户上报描述兜底 */
    static composeAddressText(reverse: ReverseAddressResult | null, label?: string): string;
    /** 地址文本 → 坐标；失败返回 null */
    geocode(ctx: RequestContext, address: string | null | undefined, hint?: {
        city?: string | null;
        district?: string | null;
    }): Promise<GeocodeResult | null>;
    /** 微信位置坐标 → 结构化地址；失败返回 null */
    reverse(ctx: RequestContext, lat: number, lng: number): Promise<ReverseAddressResult | null>;
    private readCache;
    private writeCache;
}
