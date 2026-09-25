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
exports.ReservationTtlColumnMigration = void 0;
// 幂等补 channel.reservationTtlMinutes 自定义字段列。
// Vendure 命名规则：customFields + 首字母大写字段名、其余小写 → customFieldsReservationttlminutes
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let ReservationTtlColumnMigration = class ReservationTtlColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('Channel').tableName;
            const COL = 'customFieldsReservationttlminutes';
            const runner = this.connection.createQueryRunner();
            try {
                if (!(await runner.hasColumn(tableName, COL))) {
                    await runner.addColumn(tableName, new typeorm_2.TableColumn({ name: COL, type: 'int', isNullable: true }));
                    // eslint-disable-next-line no-console
                    console.log(`[ReservationTtlColumnMigration] added ${tableName}.${COL}`);
                }
            }
            finally {
                await runner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[ReservationTtlColumnMigration] failed to ensure column:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.ReservationTtlColumnMigration = ReservationTtlColumnMigration;
exports.ReservationTtlColumnMigration = ReservationTtlColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], ReservationTtlColumnMigration);
//# sourceMappingURL=migrate-reservation-ttl-column.js.map