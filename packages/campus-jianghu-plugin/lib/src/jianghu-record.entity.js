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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JianghuRecord = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 声望/情报流水。幂等键 (customerId + reason + taskId + channelId) 唯一索引，
 * 防止核销/审核重放导致重复入账（事务内唯一冲突即视为已处理）。
 */
let JianghuRecord = class JianghuRecord extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuRecord = JianghuRecord;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], JianghuRecord.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuRecord.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuRecord.prototype, "idempotentKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuRecord.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuRecord.prototype, "reasonText", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuRecord.prototype, "deltaRep", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuRecord.prototype, "deltaIntel", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuRecord.prototype, "snapshotRep", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuRecord.prototype, "channelId", void 0);
exports.JianghuRecord = JianghuRecord = __decorate([
    (0, typeorm_1.Entity)('jianghu_record'),
    (0, typeorm_1.Index)(['customerId']),
    (0, typeorm_1.Index)(['idempotentKey'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], JianghuRecord);
//# sourceMappingURL=jianghu-record.entity.js.map