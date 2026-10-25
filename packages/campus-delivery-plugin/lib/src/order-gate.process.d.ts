import { OrderProcess, TransactionalConnection } from '@vendure/core';
export declare function bindOrderGateConnection(conn: TransactionalConnection): void;
export declare const BLACKLIST_MESSAGE = "\u8BE5\u8D26\u53F7\u6682\u4E0D\u53EF\u4E0B\u5355\uFF0C\u5982\u6709\u7591\u95EE\u8BF7\u8054\u7CFB\u5546\u5BB6\u5BA2\u670D";
/** 黑名单校验：返回 true 表示命中（导出便于单测） */
export declare function isBlacklisted(conn: TransactionalConnection, channelId: number, orderId: number): Promise<boolean>;
/** 沽清校验：返回首个售罄商品名（null=全部可售） */
export declare function findSoldOutProductName(conn: TransactionalConnection, orderId: number): Promise<string | null>;
export declare const campusOrderGateProcess: OrderProcess<any>;
