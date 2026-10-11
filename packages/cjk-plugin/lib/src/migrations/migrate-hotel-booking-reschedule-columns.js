"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelBookingRescheduleColumnsMigration = void 0;
// 幂等补 hotel_booking P4 Task 15 改期列：
// - rescheduleCount：已使用改期次数（int，default 0）
// - rescheduledAt：最近改期时间
// - reschedulePendingJson：待支付补差的改期意向（text）
// 生产（PostgreSQL）与本地（SQLite）均可能关闭 synchronize，启动期幂等补列；失败仅告警不阻塞。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const booking_entity_1 = require("../hotel/booking/booking.entity");
let HotelBookingRescheduleColumnsMigration = class HotelBookingRescheduleColumnsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata(booking_entity_1.HotelBooking).tableName;
            const qr = this.connection.createQueryRunner();
            try {
                const specs = [
                    { name: 'rescheduleCount', type: 'integer', isNullable: false, default: '0' },
                    { name: 'rescheduledAt', type: 'timestamp', isNullable: true },
                    { name: 'reschedulePendingJson', type: 'text', isNullable: true },
                ];
                for (const spec of specs) {
                    if (!(await qr.hasColumn(tableName, spec.name))) {
                        await qr.addColumn(tableName, new typeorm_2.TableColumn({
                            name: spec.name,
                            type: spec.type,
                            isNullable: spec.isNullable,
                            default: spec.default,
                        }));
                        // eslint-disable-next-line no-console
                        console.log(`[HotelBookingRescheduleColumnsMigration] added ${tableName}.${spec.name}`);
                    }
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[HotelBookingRescheduleColumnsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.HotelBookingRescheduleColumnsMigration = HotelBookingRescheduleColumnsMigration;
exports.HotelBookingRescheduleColumnsMigration = HotelBookingRescheduleColumnsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], HotelBookingRescheduleColumnsMigration);
//# sourceMappingURL=migrate-hotel-booking-reschedule-columns.js.map