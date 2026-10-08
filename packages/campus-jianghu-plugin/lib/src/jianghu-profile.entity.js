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
exports.JianghuProfile = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 江湖传信者档案：1:1 挂 Customer。
 * 段位/声望/结构性晋升计数/日上限均落在此表；声望变动通过 JianghuRecord 留痕。
 */
let JianghuProfile = class JianghuProfile extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuProfile = JianghuProfile;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: '江湖新丁' }),
    __metadata("design:type", String)
], JianghuProfile.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "rep", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "intel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'L1' }),
    __metadata("design:type", String)
], JianghuProfile.prototype, "rankCode", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 100 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "credit", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "letterDone", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "intelDone", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "plotDone", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "urgentDone", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "secretDone", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "repToday", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 300 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "repDailyCap", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuProfile.prototype, "repDay", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "streakDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuProfile.prototype, "lastActiveDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuProfile.prototype, "protectedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuProfile.prototype, "frozenUntil", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuProfile.prototype, "violateCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuProfile.prototype, "campusCode", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], JianghuProfile.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], JianghuProfile.prototype, "channel", void 0);
exports.JianghuProfile = JianghuProfile = __decorate([
    (0, typeorm_1.Entity)('jianghu_profile'),
    (0, typeorm_1.Index)(['customerId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], JianghuProfile);
//# sourceMappingURL=jianghu-profile.entity.js.map