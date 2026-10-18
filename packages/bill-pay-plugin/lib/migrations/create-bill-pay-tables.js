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
exports.CreateBillPayTablesMigration = void 0;
// 幂等建 bill-pay 四表：bill_pay_order / merchant_agreement / bill_pay_settlement / bill_pay_config。
// 纯增量：只建新表，不改任何既有表（§15 护栏）。生产 PG 与本地 SQLite 都可能关闭 synchronize。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const BASE_COLUMNS = [
    { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
    { name: 'createdAt', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
    { name: 'updatedAt', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
];
const TABLES = [
    new typeorm_2.Table({
        name: 'bill_pay_order',
        columns: [
            ...BASE_COLUMNS,
            { name: 'code', type: 'varchar', isNullable: true },
            { name: 'customerId', type: 'int', isNullable: false },
            { name: 'merchantName', type: 'varchar', isNullable: false },
            { name: 'expectedAmount', type: 'int', isNullable: false },
            { name: 'quoteAmount', type: 'int', isNullable: true },
            { name: 'actualAmount', type: 'int', isNullable: true },
            { name: 'discountDetail', type: 'text', isNullable: true },
            { name: 'status', type: 'varchar', isNullable: false },
            { name: 'remark', type: 'text', isNullable: true },
            { name: 'quoteNote', type: 'text', isNullable: true },
            { name: 'quoteExpireAt', type: 'timestamp', isNullable: true },
            { name: 'proofUrl', type: 'varchar', isNullable: true },
            { name: 'payRef', type: 'varchar', isNullable: true },
            { name: 'paymentMethod', type: 'varchar', isNullable: true },
            { name: 'operatorId', type: 'int', isNullable: true },
            { name: 'settleLedgerId', type: 'int', isNullable: true },
            { name: 'paidAt', type: 'timestamp', isNullable: true },
            { name: 'completedAt', type: 'timestamp', isNullable: true },
            { name: 'settledAt', type: 'timestamp', isNullable: true },
            { name: 'refundedAt', type: 'timestamp', isNullable: true },
            { name: 'completeNote', type: 'text', isNullable: true },
            { name: 'channelId', type: 'int', isNullable: false },
        ],
    }),
    new typeorm_2.Table({
        name: 'merchant_agreement',
        columns: [
            ...BASE_COLUMNS,
            { name: 'channelId', type: 'int', isNullable: false },
            { name: 'merchantName', type: 'varchar', isNullable: false },
            { name: 'settleRate', type: 'int', isNullable: false },
            { name: 'settleMode', type: 'varchar', isNullable: false },
            { name: 'contact', type: 'varchar', isNullable: true },
            { name: 'note', type: 'text', isNullable: true },
        ],
    }),
    new typeorm_2.Table({
        name: 'bill_pay_settlement',
        columns: [
            ...BASE_COLUMNS,
            { name: 'billPayOrderId', type: 'int', isNullable: false },
            { name: 'code', type: 'varchar', isNullable: false },
            { name: 'channelId', type: 'int', isNullable: false },
            { name: 'merchantName', type: 'varchar', isNullable: false },
            { name: 'quoteAmount', type: 'int', isNullable: false },
            { name: 'actualAmount', type: 'int', isNullable: false },
            { name: 'settleRate', type: 'int', isNullable: false },
            { name: 'costAmount', type: 'int', isNullable: false },
            { name: 'grossAmount', type: 'int', isNullable: false },
            { name: 'occurredAt', type: 'timestamp', isNullable: false },
        ],
    }),
    new typeorm_2.Table({
        name: 'bill_pay_config',
        columns: [
            ...BASE_COLUMNS,
            { name: 'channelId', type: 'int', isNullable: false },
            { name: 'config', type: 'text', isNullable: false },
        ],
    }),
];
let CreateBillPayTablesMigration = class CreateBillPayTablesMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                for (const table of TABLES) {
                    if (!(await queryRunner.hasTable(table.name))) {
                        await queryRunner.createTable(table);
                    }
                }
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (e) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateBillPayTablesMigration] failed to ensure tables:', e === null || e === void 0 ? void 0 : e.message);
        }
    }
};
exports.CreateBillPayTablesMigration = CreateBillPayTablesMigration;
exports.CreateBillPayTablesMigration = CreateBillPayTablesMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], CreateBillPayTablesMigration);
//# sourceMappingURL=create-bill-pay-tables.js.map