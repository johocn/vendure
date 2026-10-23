import { ID, RequestContext } from '@vendure/core';
import { AddressChangeService } from './address-change.service';
/** 顾客端：订单详情「修改地址」（取货前可改，可跨分区，差额记台账） */
export declare class AddressChangeShopResolver {
    private service;
    constructor(service: AddressChangeService);
    campusChangeDeliveryAddress(ctx: RequestContext, orderId: ID, zoneId: ID, buildingId: ID, detail?: string): Promise<{
        diff: number;
        oldFee: number;
        newFee: number;
        fromZone: string;
        toZone: string;
        recordId: ID;
    }>;
}
/** 运营端：改址台账查询/统计/结清 */
export declare class AddressChangeAdminResolver {
    private service;
    constructor(service: AddressChangeService);
    campusAddressChanges(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<import("./campus-address-change.entity").CampusAddressChange[]>;
    campusAddressChangeStats(ctx: RequestContext): Promise<{
        total: number;
        pendingCount: number;
        pendingCollect: number;
        pendingRefund: number;
    }>;
    campusSettleAddressChange(ctx: RequestContext, id: ID, action: string): Promise<import("./campus-address-change.entity").CampusAddressChange>;
}
