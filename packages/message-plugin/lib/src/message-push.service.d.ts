import { RequestContext, TransactionalConnection } from '@vendure/core';
export declare class MessagePushService {
    private connection;
    constructor(connection: TransactionalConnection);
    sendPush(ctx: RequestContext, customerId: number, title: string, body: string): Promise<void>;
    private getToken;
    private pushSingle;
}
