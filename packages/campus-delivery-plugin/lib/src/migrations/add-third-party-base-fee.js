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
exports.AddThirdPartyBaseFeeMigration = exports.addThirdPartyBaseFeeSql = void 0;
// 第三方到校配送基价（2026-10-23）：动态计价覆盖 R2 外部快递到校场景。
// null = 不接管顾客侧运费（沿用店铺普通快递运费），避免存量店铺被强制改价。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补列；IF NOT EXISTS 幂等，重复启动无副作用。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addThirdPartyBaseFeeSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "thirdPartyBaseFee" int;
`;
let AddThirdPartyBaseFeeMigration = class AddThirdPartyBaseFeeMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.addThirdPartyBaseFeeSql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 表尚未建立（首次安装先跑建表）等情况只打日志，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddThirdPartyBaseFeeMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddThirdPartyBaseFeeMigration = AddThirdPartyBaseFeeMigration;
exports.AddThirdPartyBaseFeeMigration = AddThirdPartyBaseFeeMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddThirdPartyBaseFeeMigration);
//# sourceMappingURL=add-third-party-base-fee.js.map