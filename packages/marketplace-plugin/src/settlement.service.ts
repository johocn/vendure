import { Injectable } from '@nestjs/common';
import { Channel, ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';

import { SALE_SOURCE_MARKETPLACE } from './constants';

/**
 * 对账口径：商家 Channel.customFields.settlementBasis
 * - 'paid'      已支付：PaymentSettled / PaymentAuthorized
 * - 'completed' 已完成：Delivered / Shipped（Vendure 默认订单状态机中不存在 'Completed'/'Fulfilled'，
 *                以最接近的终态 Delivered 及 Shipped 作为“已完成”口径）
 */
export type SettlementBasis = 'paid' | 'completed';

export interface MerchantSettlementEntry {
    orderId: ID;
    orderCode: string;
    state: string;
    totalWithTax: number;
    currencyCode: string;
    orderPlacedAt: Date | undefined;
    merchantChannelId: ID;
}

@Injectable()
export class SettlementService {
    constructor(private connection: TransactionalConnection) {}

    private async getMerchantChannel(
        ctx: RequestContext,
        merchantChannelId: ID,
    ): Promise<Channel | null> {
        return this.connection.getRepository(ctx, Channel).findOne({
            where: { id: merchantChannelId as any },
        });
    }

    private getStatesForBasis(basis: string): string[] {
        if (basis === 'completed') {
            return ['Delivered', 'Shipped'];
        }
        return ['PaymentSettled', 'PaymentAuthorized'];
    }

    private buildQueryBuilder(ctx: RequestContext, merchantChannelId: ID) {
        return this.connection.rawConnection
            .getRepository(Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('order.customFields.saleSource = :saleSource', {
                saleSource: SALE_SOURCE_MARKETPLACE,
            })
            .andWhere('channel.id = :channelId', { channelId: merchantChannelId });
    }

    /**
     * 对账：按 saleSource=marketplace 汇总指定商家 Channel 的订单，
     * 依据 settlementBasis（paid/completed）过滤订单状态。
     */
    async exportMerchantSettlement(
        ctx: RequestContext,
        merchantChannelId: ID,
        from?: Date,
        to?: Date,
    ): Promise<MerchantSettlementEntry[]> {
        const channel = await this.getMerchantChannel(ctx, merchantChannelId);
        const basis = channel?.customFields?.settlementBasis ?? 'paid';
        const states = this.getStatesForBasis(basis);

        const qb = this.buildQueryBuilder(ctx, merchantChannelId).andWhere('order.state IN (:...states)', {
            states,
        });
        if (from) {
            qb.andWhere('order.orderPlacedAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('order.orderPlacedAt <= :to', { to });
        }
        const orders = await qb.orderBy('order.orderPlacedAt', 'ASC').getMany();

        return orders.map(order => ({
            orderId: order.id,
            orderCode: order.code,
            state: order.state,
            totalWithTax: order.totalWithTax,
            currencyCode: order.currencyCode,
            orderPlacedAt: order.orderPlacedAt,
            merchantChannelId: merchantChannelId as string,
        }));
    }

    /** 商家订单查询（含对账状态过滤所需的基础信息） */
    async listMerchantOrders(
        ctx: RequestContext,
        merchantChannelId: ID,
        from?: Date,
        to?: Date,
    ): Promise<Order[]> {
        const qb = this.buildQueryBuilder(ctx, merchantChannelId);
        if (from) {
            qb.andWhere('order.orderPlacedAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('order.orderPlacedAt <= :to', { to });
        }
        return qb.orderBy('order.orderPlacedAt', 'DESC').getMany();
    }
}