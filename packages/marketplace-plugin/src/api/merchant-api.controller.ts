import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import {
    Channel,
    ChannelService,
    RequestContext,
} from '@vendure/core';

import { SettlementService } from '../settlement.service';

/**
 * 商家对账 / 订单查询 REST API。
 *
 * 鉴权：校验 `Authorization: Bearer <channelToken>`，其中 channelToken 即该商家
 * Channel 的 token（注册商家时生成，格式如 `${shopCode}-token`）。
 * 通过 ChannelService.getChannelFromToken 将 token 解析为商家 Channel。
 *
 * 注意：当前实现依赖 Channel token 作为共享密钥，未接入 Vendure 的完整
 * JWT/APIKey 鉴权体系。如需更严格的鉴权，可在此基础上接入
 * JwtStrategy / ApiKey 校验。
 */
@Controller('merchant-api')
export class MerchantApiController {
    constructor(
        private channelService: ChannelService,
        private settlementService: SettlementService,
    ) {}

    private async resolveChannel(authHeader?: string) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header');
        }
        const token = authHeader.slice('Bearer '.length).trim();
        if (!token) {
            throw new UnauthorizedException('Missing channel token');
        }
        const channel = await this.channelService.getChannelFromToken(token);
        if (!channel) {
            throw new UnauthorizedException('Invalid channel token');
        }
        return channel;
    }

    private buildCtx(channel: Channel): RequestContext {
        return new RequestContext({
            apiType: 'admin',
            channel: channel as any,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /** 对账单：GET /merchant-api/settlement?from=ISO&to=ISO */
    @Get('settlement')
    async settlement(
        @Headers('authorization') authHeader: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const channel = await this.resolveChannel(authHeader);
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;
        const ctx = this.buildCtx(channel);
        const entries = await this.settlementService.exportMerchantSettlement(
            ctx,
            channel.id,
            fromDate,
            toDate,
        );
        const total = entries.reduce((sum, e) => sum + e.totalWithTax, 0);
        return { count: entries.length, totalWithTax: total, entries };
    }

    /** 订单查询：GET /merchant-api/orders?from=ISO&to=ISO */
    @Get('orders')
    async orders(
        @Headers('authorization') authHeader: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const channel = await this.resolveChannel(authHeader);
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;
        const ctx = this.buildCtx(channel);
        const orders = await this.settlementService.listMerchantOrders(ctx, channel.id, fromDate, toDate);
        return {
            count: orders.length,
            items: orders.map(o => ({
                orderId: o.id,
                orderCode: o.code,
                state: o.state,
                totalWithTax: o.totalWithTax,
                currencyCode: o.currencyCode,
                orderPlacedAt: o.orderPlacedAt,
            })),
        };
    }
}