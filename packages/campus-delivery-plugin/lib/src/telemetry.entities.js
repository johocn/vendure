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
exports.CampusErrorReport = exports.CampusTrackEvent = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * P4-4 前端埋点：C 端（匿名可用）批量上报的行为事件。
 * 表由 p11-telemetry 迁移创建（生产 synchronize:false）。
 */
let CampusTrackEvent = class CampusTrackEvent extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusTrackEvent = CampusTrackEvent;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CampusTrackEvent.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], CampusTrackEvent.prototype, "eventName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "props", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "ua", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], CampusTrackEvent.prototype, "ip", void 0);
exports.CampusTrackEvent = CampusTrackEvent = __decorate([
    (0, typeorm_1.Entity)('campus_track_event'),
    __metadata("design:paramtypes", [Object])
], CampusTrackEvent);
/**
 * P4-4 前端错误上报：C 端 / 后台的未捕获异常与 Promise rejection。
 * 与埋点同表族，后台「系统监控」页统一消费。
 */
let CampusErrorReport = class CampusErrorReport extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusErrorReport = CampusErrorReport;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CampusErrorReport.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], CampusErrorReport.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], CampusErrorReport.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CampusErrorReport.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusErrorReport.prototype, "stack", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], CampusErrorReport.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], CampusErrorReport.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], CampusErrorReport.prototype, "ua", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusErrorReport.prototype, "customerId", void 0);
exports.CampusErrorReport = CampusErrorReport = __decorate([
    (0, typeorm_1.Entity)('campus_error_report'),
    __metadata("design:paramtypes", [Object])
], CampusErrorReport);
//# sourceMappingURL=telemetry.entities.js.map