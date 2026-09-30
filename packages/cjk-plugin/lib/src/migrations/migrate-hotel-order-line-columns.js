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
exports.HotelOrderLineColumnMigration = void 0;
// 确保 order_line 表存在酒店订单行自定义字段列（入住/离店/晚数）。
// Vendure 自定义字段列名规则 = customFields + 首字母大写字段名，其余小写：
//   hotelCheckIn → customFieldsHotelcheckin
//   hotelCheckOut → customFieldsHotelcheckout
//   hotelNights → customFieldsHotelnights
// 生产（PostgreSQL）与本地开发（SQLite）均可能关闭 synchronize，故此 migration 幂等地补列；
// 失败仅 console.error，不阻塞启动。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let HotelOrderLineColumnMigration = class HotelOrderLineColumnMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const tableName = this.connection.getMetadata('OrderLine').tableName;
            const qr = this.connection.createQueryRunner();
            try {
                const ensure = async (name, type) => {
                    if (!(await qr.hasColumn(tableName, name))) {
                        await qr.addColumn(tableName, new typeorm_2.TableColumn({ name, type, isNullable: true }));
                        // eslint-disable-next-line no-console
                        console.log(`[HotelOrderLineColumnMigration] added ${tableName}.${name}`);
                    }
                };
                await ensure('customFieldsHotelcheckin', 'varchar(255)');
                await ensure('customFieldsHotelcheckout', 'varchar(255)');
                await ensure('customFieldsHotelnights', 'integer');
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[HotelOrderLineColumnMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.HotelOrderLineColumnMigration = HotelOrderLineColumnMigration;
exports.HotelOrderLineColumnMigration = HotelOrderLineColumnMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], HotelOrderLineColumnMigration);
//# sourceMappingURL=migrate-hotel-order-line-columns.js.map