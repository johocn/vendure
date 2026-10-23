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
    /** 顾客端：本单最近一次改址差额状态（待补/待退/已结清） */
    campusMyAddressChange(ctx: RequestContext, orderId: ID): Promise<{
        id: ID;
        diff: number;
        status: string;
        settleAction: string | null;
        fromZone: string;
        fromBuilding: string;
        toZone: string;
        toBuilding: string;
        createdAt: Date;
    } | null>;
}
/** 运营端：改址台账查询/统计/结清 */
export declare class AddressChangeAdminResolver {
    private service;
    constructor(service: AddressChangeService);
    campusAddressChanges(ctx: RequestContext, status?: string, orderId?: ID, skip?: number, take?: number): Promise<import("./campus-address-change.entity").CampusAddressChange[]>;
    campusAddressChangeStats(ctx: RequestContext): Promise<{
        total: number;
        pendingCount: number;
        pendingCollect: number;
        pendingRefund: number;
    }>;
    campusSettleAddressChange(ctx: RequestContext, id: ID, action: string, note?: string): Promise<import("./campus-address-change.entity").CampusAddressChange>;
    /** 运营代客改址（取货后也可代改，必须填原因） */
    campusAdminChangeDeliveryAddress(ctx: RequestContext, orderId: ID, zoneId: ID, buildingId: ID, detail: string | undefined, reason: string): Promise<{
        diff: number;
        oldFee: number;
        newFee: number;
        fromZone: string;
        toZone: string;
        recordId: ID;
    }>;
    /** 改址差额试算（不写台账） */
    campusAdminQuoteAddressChange(ctx: RequestContext, orderId: ID, zoneId: ID): Promise<{
        oldFee: number;
        newFee: number;
        diff: number;
        zoneId: any;
        zoneName: string;
        buildings: import("./campus-building.entity").CampusBuilding[];
    }>;
    /** 动态计价试算预览（当前供需 + 各分区加价拆解） */
    campusDynamicPricingPreview(ctx: RequestContext): Promise<{
        at: string;
        enabled: boolean;
        backlog: number;
        onlineRiders: number;
        manualMultiplier: number;
        maxAddFee: number;
        errand: {
            key: "errand" | "third-party";
            configured: boolean;
            baseFee: number;
            price: number;
            addFee: number;
            breakdown: import("./dynamic-pricing").PricingBreakdownItem[];
        } | null;
        thirdParty: {
            key: "errand" | "third-party";
            configured: boolean;
            baseFee: number;
            price: number;
            addFee: number;
            breakdown: import("./dynamic-pricing").PricingBreakdownItem[];
        } | null;
        supply: {
            backlogThreshold: number;
            riderThreshold: number | null;
            addFee: number;
        } | null;
        peakWindows: import("./dynamic-pricing").PeakWindow[];
        zones: {
            zoneId: any;
            zoneName: string;
            baseFee: number;
            price: number;
            addFee: number;
            breakdown: import("./dynamic-pricing").PricingBreakdownItem[];
        }[];
    }>;
}
