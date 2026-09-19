import { ID, RequestContext } from '@vendure/core';
import { ReservationSplit, StockReservationService } from './stock-reservation.service';
export declare class StockReservationAdminResolver {
    private service;
    constructor(service: StockReservationService);
    reservations(ctx: RequestContext, status?: string, variantId?: ID, orderId?: ID, page?: number, pageSize?: number): Promise<{
        items: import("./stock-reservation.entity").StockReservationEntity[];
        totalItems: number;
    }>;
    reservation(ctx: RequestContext, id: ID): Promise<{
        items: import("./stock-reservation-item.entity").StockReservationItemEntity[];
        id: number;
        orderId: number;
        orderLineId: number;
        variantId: number;
        totalQty: number;
        status: import("./stock-reservation.entity").ReservationStatus;
        tenantChannelId: string;
        createdAt: Date;
    }>;
    reservationReconcile(ctx: RequestContext): Promise<{
        variantId: number;
        physicalSum: number;
        virtualSum: number;
        pendingQty: number;
        diff: number;
    }[]>;
    allocateReservation(ctx: RequestContext, id: ID, splits: ReservationSplit[]): Promise<{
        items: import("./stock-reservation-item.entity").StockReservationItemEntity[];
        id: number;
        orderId: number;
        orderLineId: number;
        variantId: number;
        totalQty: number;
        status: import("./stock-reservation.entity").ReservationStatus;
        tenantChannelId: string;
        createdAt: Date;
    }>;
    fulfillReservationItem(ctx: RequestContext, id: ID, quantity?: number): Promise<import("./stock-reservation-item.entity").StockReservationItemEntity>;
    releaseReservation(ctx: RequestContext, id: ID): Promise<import("./stock-reservation.entity").StockReservationEntity>;
}
