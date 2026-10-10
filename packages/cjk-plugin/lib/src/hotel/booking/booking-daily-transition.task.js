"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelBookingDailyTransitionTask = exports.HOTEL_BOOKING_DAILY_TRANSITION_TASK_ID = void 0;
// 酒店预订日常流转（P3 Task 10）：每日把 checkedIn 且已到离店日的置 completed、
// confirmed 且已过离店日仍未入住的标记 noShow。noShow 不动锁（过去晚 booked 锁留审计）。
const core_1 = require("@vendure/core");
const booking_service_1 = require("./booking.service");
exports.HOTEL_BOOKING_DAILY_TRANSITION_TASK_ID = 'hotel-booking-daily-transition';
exports.hotelBookingDailyTransitionTask = new core_1.ScheduledTask({
    id: exports.HOTEL_BOOKING_DAILY_TRANSITION_TASK_ID,
    description: 'Hotel booking daily transitions: checkedIn→completed on checkout day, confirmed→noShow after checkout day',
    schedule: cron => cron.every(1).days(),
    timeout: 60 * 1000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const service = injector.get(booking_service_1.HotelBookingService);
        const result = await service.runDailyTransitions(scheduledContext);
        return result;
    },
});
//# sourceMappingURL=booking-daily-transition.task.js.map