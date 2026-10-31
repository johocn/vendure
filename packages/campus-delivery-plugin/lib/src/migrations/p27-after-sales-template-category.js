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
exports.P27AfterSalesTemplateCategoryMigration = exports.p27AfterSalesTemplateCategorySql = void 0;
// §97（2026-10-31）：售后知识库——快捷回复模板分类、关键词检索与排序。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p27AfterSalesTemplateCategorySql = `
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS category varchar(50);
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS keywords varchar(200);
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS campus_after_sales_reply_template_category
  ON campus_after_sales_reply_template ("channelId", category);
`;
let P27AfterSalesTemplateCategoryMigration = class P27AfterSalesTemplateCategoryMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p27AfterSalesTemplateCategorySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P27AfterSalesTemplateCategoryMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P27AfterSalesTemplateCategoryMigration = P27AfterSalesTemplateCategoryMigration;
exports.P27AfterSalesTemplateCategoryMigration = P27AfterSalesTemplateCategoryMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P27AfterSalesTemplateCategoryMigration);
//# sourceMappingURL=p27-after-sales-template-category.js.map