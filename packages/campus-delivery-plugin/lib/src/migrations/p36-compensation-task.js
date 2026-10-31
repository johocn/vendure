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
exports.P36CompensationTaskMigration = exports.p36CompensationTaskSql = void 0;
// R2 补偿任务表：券/站内信失败落库 + 定时退避重试。
// 物理列名规则：属性名直接作为列名（camelCase 需双引号）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p36CompensationTaskSql = `
CREATE TABLE IF NOT EXISTS campus_compensation_task (
    id serial PRIMARY KEY,
    "orderId" int NOT NULL,
    "channelId" int NOT NULL,
    "customerId" int,
    kind varchar NOT NULL,
    payload text,
    "dedupeKey" varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'pending',
    attempts int NOT NULL DEFAULT 0,
    "nextAttemptAt" timestamp,
    "lastError" varchar,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campus_compensation_dedupe" ON campus_compensation_task ("dedupeKey");
CREATE INDEX IF NOT EXISTS "IDX_campus_compensation_due" ON campus_compensation_task (status, "nextAttemptAt");
`;
let P36CompensationTaskMigration = class P36CompensationTaskMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p36CompensationTaskSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(`${statement};`);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P36CompensationTaskMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P36CompensationTaskMigration = P36CompensationTaskMigration;
exports.P36CompensationTaskMigration = P36CompensationTaskMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P36CompensationTaskMigration);
//# sourceMappingURL=p36-compensation-task.js.map