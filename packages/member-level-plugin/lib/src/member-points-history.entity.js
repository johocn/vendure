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
exports.MemberPointsHistory = exports.PointsHistoryType = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
var PointsHistoryType;
(function (PointsHistoryType) {
    PointsHistoryType["EARN"] = "earn";
    PointsHistoryType["SPEND"] = "spend";
    PointsHistoryType["ADJUST"] = "adjust";
    PointsHistoryType["EXPIRE"] = "expire";
})(PointsHistoryType || (exports.PointsHistoryType = PointsHistoryType = {}));
let MemberPointsHistory = class MemberPointsHistory extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MemberPointsHistory = MemberPointsHistory;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MemberPointsHistory.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MemberPointsHistory.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberPointsHistory.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberPointsHistory.prototype, "balanceBefore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberPointsHistory.prototype, "balanceAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MemberPointsHistory.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MemberPointsHistory.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], MemberPointsHistory.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], MemberPointsHistory.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MemberPointsHistory.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MemberPointsHistory.prototype, "channels", void 0);
exports.MemberPointsHistory = MemberPointsHistory = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], MemberPointsHistory);
//# sourceMappingURL=member-points-history.entity.js.map