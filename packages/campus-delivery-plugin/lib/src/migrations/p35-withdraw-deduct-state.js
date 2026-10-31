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
exports.P35WithdrawDeductStateMigration = exports.p35WithdrawDeductStateSql = void 0;
// R1 提现原子化：提现申请新增扣款对账状态（intent/confirmed/deduct_failed）。
// 余额流水 remark 写入 withdraw:<id> 作为对账锚点（recharge-card 插件无需改表）。
// 物理列名规则：customFields 之外字段直接使用属性名；历史行默认 confirmed（旧流程先扣款后落库）。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.p35WithdrawDeductStateSql = `
ALTER TABLE rider_withdrawal_request
    ADD COLUMN IF NOT EXISTS "withdrawState" varchar DEFAULT 'confirmed';
`;
let P35WithdrawDeductStateMigration = class P35WithdrawDeductStateMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of exports.p35WithdrawDeductStateSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            }
            finally {
                await qr.release();
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[P35WithdrawDeductStateMigration] failed:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.P35WithdrawDeductStateMigration = P35WithdrawDeductStateMigration;
exports.P35WithdrawDeductStateMigration = P35WithdrawDeductStateMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], P35WithdrawDeductStateMigration);
//# sourceMappingURL=p35-withdraw-deduct-state.js.map