// 酒店预订日常流转（P3 Task 10）：每日把 checkedIn 且已到离店日的置 completed、
// confirmed 且已过离店日仍未入住的标记 noShow。noShow 不动锁（过去晚 booked 锁留审计）。
import { ScheduledTask } from '@vendure/core';

import { HotelBookingService } from './booking.service';

export const HOTEL_BOOKING_DAILY_TRANSITION_TASK_ID = 'hotel-booking-daily-transition';

export const hotelBookingDailyTransitionTask = new ScheduledTask({
    id: HOTEL_BOOKING_DAILY_TRANSITION_TASK_ID,
    description:
        'Hotel booking daily transitions: checkedIn→completed on checkout day, confirmed→noShow after checkout day',
    schedule: cron => cron.every(1).days(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const service = injector.get(HotelBookingService);
        const result = await service.runDailyTransitions(scheduledContext);
        return result;
    },
});
