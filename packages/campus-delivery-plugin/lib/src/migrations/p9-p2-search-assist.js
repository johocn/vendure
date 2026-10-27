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
exports.P9P2SearchAssistMigration = exports.p9P2SearchAssistSql = void 0;
// P2-2 批次（2026-10-27）：语音/拍照搜索服务商按渠道配置（mock / none）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p9P2SearchAssistSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "voiceSearchProvider" varchar(16) NOT NULL DEFAULT 'mock';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "imageSearchProvider" varchar(16) NOT NULL DEFAULT 'mock';
`;
let P9P2SearchAssistMigration = class P9P2SearchAssistMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p9P2SearchAssistSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P9P2SearchAssistMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P9P2SearchAssistMigration = P9P2SearchAssistMigration;
exports.P9P2SearchAssistMigration = P9P2SearchAssistMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P9P2SearchAssistMigration);
//# sourceMappingURL=p9-p2-search-assist.js.map