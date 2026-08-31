import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow, ConfigService, Ctx, Order, OrderService, Permission, RequestContext, UserInputError,
} from '@vendure/core';
import { RedemptionCodeService } from './redemption-code.service';

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
        };
    }
}

@Resolver()
export class RedemptionAdminResolver {
    constructor(
        private redemptionCodeService: RedemptionCodeService,
        private orderService: OrderService,
    ) {}

    @Query()
    @Allow(Permission.UpdateOrder)
    async redemptionLookup(@Ctx() ctx: RequestContext, @Args('code') code: string) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) {
            return { order: null, claimed: false, claimedAt: null };
        }
        const cf = order.customFields ?? {};
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed: !!(cf as any).redeemClaimed,
            claimedAt: (cf as any).redeemClaimedAt ?? null,
        };
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async redemptionClaim(@Ctx() ctx: RequestContext, @Args('code') code: string) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) throw new UserInputError(ERR_NOT_FOUND);
        // lookupByCode 已限当前租户 Channel，核销复用同一检索保持租户隔离
        const result = await this.redemptionCodeService.claim(ctx, order.id);
        const cf = order.customFields ?? {};
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
            claimedAt: result.claimedAt ?? (cf as any).redeemClaimedAt ?? null,
            message: result.already ? 'already' : 'ok',
        };
    }
}