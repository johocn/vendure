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
exports.BackfillWaimaiIndustryMigration = exports.backfillWaimaiIndustrySql = void 0;
// 外卖准入存量刷数（设计文档 2026-10-09 §4.3）：把已配履约配置的渠道批量置为餐饮行业，
// 避免上线行业过滤后存量外卖店从外卖首页消失。幂等：仅当 industryType 为空时写入。
// 列名 customFieldsIndustrytype 为 Vendure customFields 同步命名（实测首字母大写+小写化规则，
// 同 Order customFieldsRiderlat 先例）；若 Task 1 Step 3 实测列名不同，此处同步修改。
// 挂载机制与 CreateCampusTablesMigration 一致：注册进 plugin providers，出错等待下次启动重试。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.backfillWaimaiIndustrySql = `
UPDATE channel
SET "customFieldsIndustrytype" = 'catering'
WHERE "customFieldsIndustrytype" IS NULL
  AND id IN (SELECT "channelId" FROM campus_fulfillment_config);
`;
let BackfillWaimaiIndustryMigration = class BackfillWaimaiIndustryMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.backfillWaimaiIndustrySql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 首次启动若 customFields 列尚未同步（先于 Vendure schema 同步执行时），只打日志等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[BackfillWaimaiIndustryMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.BackfillWaimaiIndustryMigration = BackfillWaimaiIndustryMigration;
exports.BackfillWaimaiIndustryMigration = BackfillWaimaiIndustryMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], BackfillWaimaiIndustryMigration);
//# sourceMappingURL=backfill-waimai-industry.js.map