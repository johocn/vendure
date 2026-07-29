import { ID, RequestContext } from '@vendure/core';
import { MessageService } from './message.service';
export declare class MessageShopResolver {
    private messageService;
    constructor(messageService: MessageService);
    myMessages(ctx: RequestContext, options: any): Promise<import("@vendure/core").PaginatedList<any>>;
    myUnreadMessageCount(ctx: RequestContext): Promise<number>;
    markMessageRead(ctx: RequestContext, id: ID): Promise<boolean>;
}
