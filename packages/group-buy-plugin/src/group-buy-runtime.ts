import { TransactionalConnection } from '@vendure/core';

/**
 * Promotion 条件/动作在结算期同步路径里需要访问 DB（按订单关联的活动动态取 groupPrice/leaderDiscount）。
 * 这里在插件 onApplicationBootstrap 时注入 TransactionalConnection，
 * 供静态构造的 PromotionCondition / PromotionItemAction 内延迟获取（不破坏同步签名的可注入性）。
 */
let connection: TransactionalConnection | undefined;

export function setGroupBuyConnection(conn: TransactionalConnection): void {
    connection = conn;
}

export function getGroupBuyConnection(): TransactionalConnection {
    if (!connection) {
        throw new Error('GroupBuyPlugin TransactionalConnection not initialized');
    }
    return connection;
}
