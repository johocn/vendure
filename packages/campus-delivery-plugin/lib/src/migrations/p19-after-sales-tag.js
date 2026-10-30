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
exports.P19AfterSalesTagMigration = exports.p19AfterSalesTagSql = void 0;
// §88（2026-10-30）：商家售后标签 + 售后单打标关联（本店渠道共用，顾客端不可见）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p19AfterSalesTagSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_tag (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "name" varchar(12) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_tag_channel_name
  ON campus_after_sales_tag ("channelId", "name");
CREATE TABLE IF NOT EXISTS campus_after_sales_tag_link (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "tagId" integer NOT NULL,
  UNIQUE ("channelId", "requestId", "tagId")
);
CREATE INDEX IF NOT EXISTS campus_after_sales_tag_link_request
  ON campus_after_sales_tag_link ("requestId");
`;
let P19AfterSalesTagMigration = class P19AfterSalesTagMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p19AfterSalesTagSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P19AfterSalesTagMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P19AfterSalesTagMigration = P19AfterSalesTagMigration;
exports.P19AfterSalesTagMigration = P19AfterSalesTagMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P19AfterSalesTagMigration);
//# sourceMappingURL=p19-after-sales-tag.js.map