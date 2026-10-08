import { UserInputError } from '@vendure/core';
import { CREDIT_LIMIT } from './constants';
import { JianghuProfile } from './jianghu-profile.entity';

/**
 * 江湖风控：纯函数 + 轻状态校验（不依赖 DB）。
 * - 信用分 <60 或面壁期 → 冻结接取
 * - 暗号 60s 一次性、6 位
 * - LBS 围栏 haversine 半径判定
 */
export class JianghuRiskService {
    /** 6 位数字一次性暗号 */
    genCode(): string {
        let s = '';
        for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
        return s;
    }

    /** haversine 距离（米），无坐标任务直接放行 */
    withinFence(lat: number, lng: number, tLat: number, tLng: number, meters: number): boolean {
        if (!tLat || !tLng) return true;
        const R = 6371000;
        const dLat = ((lat - tLat) * Math.PI) / 180;
        const dLng = ((lng - tLng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        return d <= meters;
    }

    /** haversine 距离（公里）；缺坐标返回 null */
    distanceKm(lat?: number, lng?: number, tLat?: number, tLng?: number): number | null {
        if (lat == null || lng == null || !tLat || !tLng) return null;
        const R = 6371;
        const dLat = ((lat - tLat) * Math.PI) / 180;
        const dLng = ((lng - tLng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    assertNotFrozen(profile: JianghuProfile, customer?: { customFields?: any }): void {
        const credit = profile.credit ?? (customer?.customFields?.riderCredit ?? 100);
        if (credit < CREDIT_LIMIT) {
            throw new UserInputError('信用分低于 60，江湖任务已冻结');
        }
        if (profile.frozenUntil && new Date(profile.frozenUntil).getTime() > Date.now()) {
            throw new UserInputError('面壁中，暂不可接取江湖任务');
        }
    }
}
