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
exports.CampusPrintJob = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 云打印任务留痕（P1-4）：一单一任务，失败可在后台看原因并重打 */
let CampusPrintJob = class CampusPrintJob extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusPrintJob = CampusPrintJob;
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], CampusPrintJob.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "deviceSn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'pending' }),
    __metadata("design:type", String)
], CampusPrintJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], CampusPrintJob.prototype, "triggerType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], CampusPrintJob.prototype, "copies", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], CampusPrintJob.prototype, "dryRun", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "durationMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusPrintJob.prototype, "content", void 0);
exports.CampusPrintJob = CampusPrintJob = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CampusPrintJob);
//# sourceMappingURL=campus-print-job.entity.js.map