import { JianghuProfile } from './jianghu-profile.entity';
/**
 * 江湖风控：纯函数 + 轻状态校验（不依赖 DB）。
 * - 信用分 <60 或面壁期 → 冻结接取
 * - 暗号 60s 一次性、6 位
 * - LBS 围栏 haversine 半径判定
 */
export declare class JianghuRiskService {
    /** 6 位数字一次性暗号 */
    genCode(): string;
    /** haversine 距离（米），无坐标任务直接放行 */
    withinFence(lat: number, lng: number, tLat: number, tLng: number, meters: number): boolean;
    /** haversine 距离（公里）；缺坐标返回 null */
    distanceKm(lat?: number, lng?: number, tLat?: number, tLng?: number): number | null;
    assertNotFrozen(profile: JianghuProfile, customer?: {
        customFields?: any;
    }): void;
}
