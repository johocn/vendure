import { ID, RequestContext } from '@vendure/core';
import { PaymentScheduleService } from './payment-schedule.service';
export declare class PaymentScheduleShopResolver {
    private scheduleService;
    constructor(scheduleService: PaymentScheduleService);
    paymentSchedule(ctx: RequestContext, orderId: ID): Promise<any | null>;
    paySchedulePeriod(ctx: RequestContext, orderId: ID, seq: number, method: string): Promise<any>;
    cancelSchedule(ctx: RequestContext, orderId: ID, confirmForfeit?: boolean): Promise<any>;
}
