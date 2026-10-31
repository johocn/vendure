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
exports.P33ChannelWaimaiColumnsMigration = exports.p33ChannelWaimaiColumnsSql = void 0;
// P1 F11（2026-10-31）：补齐 Channel 店铺展示/营业时间 5 个自定义字段的物理列。
// 这些字段已在使用（否则生产配置读取会报错），但历史迁移未落 ADD COLUMN；新环境重建会缺列。
// 物理列名规则：customFields + 字段名首字母大写、其余小写（TypeORM 行为）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p33ChannelWaimaiColumnsSql = `
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaitags" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaimonthlysales" int;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimailogo" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaipromotext" varchar;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaibusinesshours" varchar;
`;
let P33ChannelWaimaiColumnsMigration = class P33ChannelWaimaiColumnsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p33ChannelWaimaiColumnsSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P33ChannelWaimaiColumnsMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P33ChannelWaimaiColumnsMigration = P33ChannelWaimaiColumnsMigration;
exports.P33ChannelWaimaiColumnsMigration = P33ChannelWaimaiColumnsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P33ChannelWaimaiColumnsMigration);
//# sourceMappingURL=p33-channel-waimai-columns.js.map