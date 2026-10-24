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
exports.AddAddressChangeSettleProofMigration = exports.addAddressChangeSettleProofSql = void 0;
// 改址台账结清凭证（2026-10-23）：补收备注 + 实际退款单 id
// IF NOT EXISTS 幂等，生产关闭 synchronize 时启动补列。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.addAddressChangeSettleProofSql = `
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "settleNote" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "refundId" int;
`;
let AddAddressChangeSettleProofMigration = class AddAddressChangeSettleProofMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(exports.addAddressChangeSettleProofSql);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[AddAddressChangeSettleProofMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.AddAddressChangeSettleProofMigration = AddAddressChangeSettleProofMigration;
exports.AddAddressChangeSettleProofMigration = AddAddressChangeSettleProofMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], AddAddressChangeSettleProofMigration);
//# sourceMappingURL=add-address-change-settle-proof.js.map