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
exports.CampusRiderReview = exports.CampusRiderSession = exports.CampusRiderShift = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 骑手排班：按日期 + 时段登记，后台视图展示「排班 vs 实际在线」。 */
let CampusRiderShift = class CampusRiderShift extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusRiderShift = CampusRiderShift;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderShift.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderShift.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], CampusRiderShift.prototype, "shiftDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], CampusRiderShift.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], CampusRiderShift.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderShift.prototype, "note", void 0);
exports.CampusRiderShift = CampusRiderShift = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CampusRiderShift);
/** 骑手在线会话：上线开、下线/心跳超时关，用于统计实际在线时长。 */
let CampusRiderSession = class CampusRiderSession extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusRiderSession = CampusRiderSession;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderSession.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderSession.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CampusRiderSession.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderSession.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderSession.prototype, "lastHeartbeatAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderSession.prototype, "minutes", void 0);
exports.CampusRiderSession = CampusRiderSession = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CampusRiderSession);
/** 用户给骑手评分（1-5 + 标签，一单一条幂等）。 */
let CampusRiderReview = class CampusRiderReview extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusRiderReview = CampusRiderReview;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderReview.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderReview.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], CampusRiderReview.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CampusRiderReview.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderReview.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderReview.prototype, "comment", void 0);
exports.CampusRiderReview = CampusRiderReview = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CampusRiderReview);
//# sourceMappingURL=rider-ops.entities.js.map