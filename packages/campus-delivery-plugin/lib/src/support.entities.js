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
exports.CampusBlacklist = exports.CampusRiderAppeal = exports.CampusSupportTicket = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 客服工单（站内留言，非实时 IM）：顾客提交 → 运营回复 → 关闭。 */
let CampusSupportTicket = class CampusSupportTicket extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusSupportTicket = CampusSupportTicket;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "orderCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CampusSupportTicket.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CampusSupportTicket.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'open' }),
    __metadata("design:type", String)
], CampusSupportTicket.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "reply", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "repliedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusSupportTicket.prototype, "repliedAt", void 0);
exports.CampusSupportTicket = CampusSupportTicket = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_support_ticket_channel', ['channelId', 'status']),
    __metadata("design:paramtypes", [Object])
], CampusSupportTicket);
/** 骑手申诉：信用扣分申诉单，后台审核通过后回补信用分。 */
let CampusRiderAppeal = class CampusRiderAppeal extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusRiderAppeal = CampusRiderAppeal;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "orderCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CampusRiderAppeal.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], CampusRiderAppeal.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusRiderAppeal.prototype, "creditDelta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "reviewNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusRiderAppeal.prototype, "reviewedAt", void 0);
exports.CampusRiderAppeal = CampusRiderAppeal = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_rider_appeal_channel', ['channelId', 'status']),
    __metadata("design:paramtypes", [Object])
], CampusRiderAppeal);
/** 下单黑名单：user（customerId）/ phone。命中后在支付前置闸门拦截。 */
let CampusBlacklist = class CampusBlacklist extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusBlacklist = CampusBlacklist;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusBlacklist.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CampusBlacklist.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusBlacklist.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusBlacklist.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusBlacklist.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusBlacklist.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], CampusBlacklist.prototype, "active", void 0);
exports.CampusBlacklist = CampusBlacklist = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_blacklist_channel', ['channelId', 'active']),
    __metadata("design:paramtypes", [Object])
], CampusBlacklist);
//# sourceMappingURL=support.entities.js.map