import { CustomerService, ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusAddressChange } from './campus-address-change.entity';
export declare class AddressChangeService {
    private connection;
    private orderService;
    private customerService;
    constructor(connection: TransactionalConnection, orderService: OrderService, customerService: CustomerService);
    /** 顾客自助改址（取货前、可跨分区）。差额不阻塞改址，写入台账待运营结算。 */
    changeByCustomer(ctx: RequestContext, input: {
        orderId: ID;
        zoneId: ID;
        buildingId: ID;
        detail?: string;
    }): Promise<{
        diff: number;
        oldFee: number;
        newFee: number;
        fromZone: string;
        toZone: string;
        recordId: ID;
    }>;
    list(ctx: RequestContext, opts?: {
        status?: string;
        skip?: number;
        take?: number;
    }): Promise<CampusAddressChange[]>;
    stats(ctx: RequestContext): Promise<{
        total: number;
        pendingCount: number;
        pendingCollect: number;
        pendingRefund: number;
    }>;
    /** 运营结清：refund=已退顾客 / collect=已补收 / waive=免收 / pending=撤销结清 */
    settle(ctx: RequestContext, id: ID, action: string): Promise<CampusAddressChange>;
    private channelIdOf;
}
