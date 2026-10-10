import { CustomerService, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelBookingService } from './booking.service';
import { HotelBooking } from './booking.entity';
export declare class HotelBookingShopResolver {
    private bookingService;
    private customerService;
    private conn;
    constructor(bookingService: HotelBookingService, customerService: CustomerService, conn: TransactionalConnection);
    myHotelBookings(ctx: RequestContext, status?: string): Promise<HotelBooking[]>;
}
