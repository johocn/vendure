import { Injectable } from '@nestjs/common';
import {
    ForbiddenError,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

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

    private async countCouponByStatus(
        ctx: RequestContext,
        now: Date,
    ): Promise<{ active: number; upcoming: number; ended: number }> {
        try {
            const repo = this.connection.getRepository(ctx, 'Coupon' as any);
            const active = await repo
                .createQueryBuilder('e')
                .where('e.isActive = :isActive', { isActive: true })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
            const upcoming = await repo
                .createQueryBuilder('e')
                .where('e.startAt > :now', { now })
                .getCount();
            const ended = await repo
                .createQueryBuilder('e')
                .where('e.endAt < :now', { now })
                .getCount();
            return { active, upcoming, ended };
        } catch {
            return { active: 0, upcoming: 0, ended: 0 };
        }
    }
}
