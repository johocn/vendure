import { Injectable } from '@nestjs/common';
import {
    ForbiddenError,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { CouponTemplate } from '@vendure/coupon-plugin';

import { OperationsPermissions } from '../constants';

export interface MarketingOverview {
    flashSale: { active: number; upcoming: number; ended: number };
    groupBuy: { active: number; upcoming: number; ended: number };
    coupon: { active: number; upcoming: number; ended: number };
}

@Injectable()
export class MarketingOverviewService {
    constructor(private connection: TransactionalConnection) {}

    private assertPermission(ctx: RequestContext): void {
        if (!ctx.userHasPermissions([OperationsPermissions.ManagePromotion as any])) {
            throw new ForbiddenError();
        }
    }

    async getOverview(ctx: RequestContext): Promise<MarketingOverview> {
        this.assertPermission(ctx);
        const now = new Date();

        const flashSale = await this.countByStatus(ctx, 'FlashSaleActivity' as any, now);
        const groupBuy = await this.countByStatus(ctx, 'GroupBuyActivity' as any, now);
        const coupon = await this.countCouponByStatus(ctx, now);

        return { flashSale, groupBuy, coupon };
    }

    private async countByStatus(
        ctx: RequestContext,
        entityName: string,
        now: Date,
    ): Promise<{ active: number; upcoming: number; ended: number }> {
        try {
            const repo = this.connection.getRepository(ctx, entityName as any);
            const active = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
            const upcoming = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'upcoming' })
                .orWhere('e.startAt > :now', { now })
                .getCount();
            const ended = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'ended' })
                .orWhere('e.endAt < :now', { now })
                .getCount();
            return { active, upcoming, ended };
        } catch {
            return { active: 0, upcoming: 0, ended: 0 };
        }
    }

    /**
     * 券数量按状态统计。
     *
     * 注（2026-09-30）：coupon-plugin 在 2026-09-19 重构后**已不存在 `Coupon` 实体**
     * （改为 `CouponTemplate` + `CustomerCoupon`），旧实现 `getRepository(ctx, 'Coupon')`
     * 的报错被外层 try/catch 吞掉，导致券数量恒为 0/0/0。这里改用 `CouponTemplate`
     * （字段 `enabled` / `startsAt` / `endsAt`，两者均可为空 = 长期有效）。
     */
    private async countCouponByStatus(
        ctx: RequestContext,
        now: Date,
    ): Promise<{ active: number; upcoming: number; ended: number }> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const active = await repo
            .createQueryBuilder('e')
            .where('e.enabled = :enabled', { enabled: true })
            .andWhere('(e.startsAt IS NULL OR e.startsAt <= :now)', { now })
            .andWhere('(e.endsAt IS NULL OR e.endsAt >= :now)', { now })
            .getCount();
        const upcoming = await repo
            .createQueryBuilder('e')
            .where('e.startsAt > :now', { now })
            .getCount();
        const ended = await repo
            .createQueryBuilder('e')
            .where('e.endsAt < :now', { now })
            .getCount();
        return { active, upcoming, ended };
    }
}
