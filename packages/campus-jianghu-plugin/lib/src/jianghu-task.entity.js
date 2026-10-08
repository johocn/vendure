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
exports.JianghuTask = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 江湖任务（三方向共用主表，type 区分 LETTER / INTEL / PLOT）。
 * OPEN → TAKEN → SUBMITTED → VERIFIED / REJECTED，超时回 OPEN 或 EXPIRED。
 */
let JianghuTask = class JianghuTask extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuTask = JianghuTask;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuTask.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuTask.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuTask.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "brief", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "plainText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "campusCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "buildingCode", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "targetCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "targetNick", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "targetBuilding", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 10 }),
    __metadata("design:type", Number)
], JianghuTask.prototype, "rewardRep", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "rewardIntel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuTask.prototype, "verifyMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "boundOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'OPEN' }),
    __metadata("design:type", String)
], JianghuTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "takenByCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "takenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "expireAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "verifyCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "codeExpireAt", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuTask.prototype, "tryCount", void 0);
__decorate([
    (0, typeorm_1.Column)('float', { nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "lat", void 0);
__decorate([
    (0, typeorm_1.Column)('float', { nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuTask.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], JianghuTask.prototype, "takenBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], JianghuTask.prototype, "target", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], JianghuTask.prototype, "channel", void 0);
exports.JianghuTask = JianghuTask = __decorate([
    (0, typeorm_1.Entity)('jianghu_task'),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['type']),
    __metadata("design:paramtypes", [Object])
], JianghuTask);
//# sourceMappingURL=jianghu-task.entity.js.map