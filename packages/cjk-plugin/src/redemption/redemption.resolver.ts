import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow, ConfigService, Ctx, EntityHydrator, Order, OrderService, Permission, RequestContext, UserInputError,
} from '@vendure/core';
import { RedemptionCodeService } from './redemption-code.service';
import { computeRedemptionStatus } from './redemption-crypto';

const ERR_NOT_FOUND = 'redemption.error.not_found';

@Resolver()
export class RedemptionShopResolver {
    constructor(
        private redemptionCodeService: RedemptionCodeService,
        private orderService: OrderService,
        private configService: ConfigService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async orderRedemptionCode(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { orderCode: string; phone?: string },
    ): Promise<any> {
        const order = (await this.orderService.findOneByCode(ctx, input.orderCode)) as Order | undefined;
        let canAccess = false;
        if (order) {
            if (input.phone) {
                const cf = order.customFields ?? {};
                canAccess = (cf as any).contactPhone === input.phone;
            } else {
                canAccess = await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
            }
        }
        if (!order || !canAccess) {
            throw new UserInputError(ERR_NOT_FOUND);
        }
        const r = await this.redemptionCodeService.getWithQr(ctx, order.id, order.code);
        return {
            redemptionCode: r.code,
            qrPayload: r.qrPayload,
            barcodePayload: r.barcode,
            claimed: r.claimed,
            canAccess: true,
            status: r.status,
            expiresAt: r.expiresAt,
            reissueable: r.reissueable,
            version: r.version,
        };
    }
}

@Resolver()
export class RedemptionAdminResolver {
    constructor(
        private redemptionCodeService: RedemptionCodeService,
        private orderService: OrderService,
        private entityHydrator: EntityHydrator,
    ) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async myPendingRedemptions(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options?: any) {
        return this.redemptionCodeService.listPending(ctx, options ?? {});
    }

    @Query()
    @Allow(Permission.UpdateOrder)
    async redemptionLookup(@Ctx() ctx: RequestContext, @Args('code') code: string) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) {
            return { order: null, claimed: false, claimedAt: null, status: 'active', expiresAt: null, version: 1, reissueable: false };
        }
        // lookupByCode 经 queryBuilder 取 order 未加载 lines，Vendure hydrator 对
        // 未加载 relation 字段访问 totalQuantity 会抛错，故先灌注 lines 再读 totalQuantity。
        await this.entityHydrator.hydrate(ctx, order, { relations: ['lines', 'payments'] } as any);
        const cf = order.customFields ?? {};
        const claimed = !!(cf as any).redeemClaimed;
        const expiresAt: string | null = (cf as any).redeemExpiresAt ?? null;
        const version = Number((cf as any).redeemVersion) || 1;
        const status = computeRedemptionStatus(claimed, expiresAt, new Date(), 24);
        const collected = !!((cf as any).collected || (cf as any).redeemCollected);
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed,
            claimedAt: (cf as any).redeemClaimedAt ?? null,
            status,
            expiresAt: expiresAt ?? (cf as any).redeemExpiresAt ?? null,
            version,
            reissueable: !claimed,
            paymentType: (order as any).payments?.[0]?.method ?? null,
            collected,
        };
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async redemptionClaim(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
        @Args('collect', { type: () => Boolean, nullable: true }) collect?: boolean,
    ) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) throw new UserInputError(ERR_NOT_FOUND);
        // 同 redemptionLookup：先灌注 lines 再读 totalQuantity，避免未加载 relation 访问抛错。
        await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] } as any);
        // lookupByCode 已限当前租户 Channel，核销复用同一检索保持租户隔离
        const result = await this.redemptionCodeService.claim(ctx, order.id, collect === true);
        const cf = order.customFields ?? {};
        const expiresAt: string | null = (cf as any).redeemExpiresAt ?? null;
        const version = Number((cf as any).redeemVersion) || 1;
        if (result.collectRequired) {
            // 强制收款：COD 未收款且未确认收款，阻止核销 → 前端弹「确认收款」后携 collect=true 重试
            return {
                order: null,
                claimed: false,
                claimedAt: null,
                message: 'REDEMPTION_COLLECT_REQUIRED',
                status: 'requires_collection',
                expiresAt: null,
                version: 0,
                collectRequired: true,
                collected: false,
            };
        }
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed: true,
            claimedAt: result.claimedAt ?? (cf as any).redeemClaimedAt ?? new Date(),
            message: result.already ? 'already' : 'ok',
            status: computeRedemptionStatus(true, expiresAt, new Date(), 24),
            expiresAt,
            version,
            collectRequired: false,
            collected: result.collected,
        };
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async redemptionReissue(@Ctx() ctx: RequestContext, @Args('code') code: string) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) throw new UserInputError(ERR_NOT_FOUND);
        const result = await this.redemptionCodeService.reissue(ctx, order.id);
        const cfr = (order.customFields ?? {}) as Record<string, any>;
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed: result.claimed,
            claimedAt: null,
            message: 'reissued',
            status: result.status,
            expiresAt: result.expiresAt,
            version: result.version,
            collectRequired: false,
            collected: !!(cfr.collected || cfr.redeemCollected),
        };
    }
}