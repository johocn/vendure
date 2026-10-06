import { OrderProcess, RequestContext, TransactionalConnection, UserInputError, Order } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';

/**
 * 起送价硬校验：拦截 → ArrangingPayment 过渡。
 * - 仅当渠道 campus 配置 minOrderAmount 非空时生效；
 * - orderKind='errand'（R5 跑腿单/接力单）豁免——跑腿费与小费不属于商品起送价；
 * - 不满足抛 UserInputError「未满起送价 ¥X」（X=元）。
 * connection 用模块级引用（与 shipping-calculator 同模式，onApplicationBootstrap 注入）。
 */
let connRef: TransactionalConnection | null = null;

export function bindMinOrderConnection(conn: TransactionalConnection) {
    connRef = conn;
}

export const campusMinOrderProcess: OrderProcess<any> = {
    async onTransitionStart(fromState, toState, { ctx, order }: { ctx: RequestContext; order: Order }) {
        if (toState !== 'ArrangingPayment') return;
        const cf = (order.customFields ?? {}) as any;
        if (cf.orderKind === 'errand') return;
        const conn = connRef;
        if (!conn) return;
        const cfg = await conn.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        if (!cfg?.minOrderAmount) return;
        if ((order.subTotal ?? 0) < cfg.minOrderAmount) {
            throw new UserInputError(`未满起送价 ¥${Number((cfg.minOrderAmount / 100).toFixed(2))}`);
        }
    },
};
