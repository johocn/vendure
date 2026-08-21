import { DefaultOrderPlacedStrategy, OrderPlacedStrategy, RequestContext } from '@vendure/core';

import { Order } from '@vendure/core';

declare module '@vendure/core' {
    interface OrderStates {
        Deposited: never;
    }
}

/**
 * 预售两阶段（定金+尾款）下单策略。
 *
 * 默认 DefaultOrderPlacedStrategy 只在 ArrangingPayment → PaymentAuthorized/PaymentSettled
 * 时把订单置为"已下单"（active=false）。定金预售引入中间态 Deposited，
 * 若付完定金不标记下单，订单会一直保持 active，导致：
 *   1. 它始终作为商城 activeOrder 被返回，无法开启下一单；
 *   2. 后续无法走取消/退款流程。
 * 因此把 ArrangingPayment → Deposited（已收定金）也视作下单完成，
 * 复用默认进程的下单收尾逻辑（active=false、orderPlacedAt、orderPlacedQuantity、OrderPlacedEvent 等）。
 */
export class PreSaleOrderPlacedStrategy extends DefaultOrderPlacedStrategy implements OrderPlacedStrategy {
    shouldSetAsPlaced(
        ctx: RequestContext,
        fromState: Order['state'],
        toState: Order['state'],
        order: Order,
    ): boolean {
        if (fromState === 'ArrangingPayment' && toState === 'Deposited') {
            return true;
        }
        return super.shouldSetAsPlaced(ctx, fromState, toState, order);
    }
}