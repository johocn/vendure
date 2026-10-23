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
exports.P4OpsHardeningMigration = exports.p4OpsHardeningSql = void 0;
// P4 履约加固（2026-10-23）：超时赔付回扫窗口可配（生产关闭 synchronize，启动幂等补列）
// P5 终态补偿（2026-10-24）：历史送达单 hallStatus 未同步（骑手送达只写 deliveryStatus）→ 幂等回填
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p4OpsHardeningSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationWindowHours" integer NOT NULL DEFAULT 24;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsExceptionreportedat" timestamp;
UPDATE "order" SET "customFieldsHallstatus" = 'delivered'
WHERE "customFieldsDeliverystatus" = 'delivered'
  AND "customFieldsHallstatus" IS NOT NULL
  AND "customFieldsHallstatus" NOT IN ('delivered', 'cancelled', 'no_rider_final', 'exception_final');
`;
let P4OpsHardeningMigration = class P4OpsHardeningMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.p4OpsHardeningSql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P4OpsHardeningMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P4OpsHardeningMigration = P4OpsHardeningMigration;
exports.P4OpsHardeningMigration = P4OpsHardeningMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P4OpsHardeningMigration);
//# sourceMappingURL=p4-ops-hardening.js.map