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
exports.MemberTier = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let MemberTier = class MemberTier extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MemberTier = MemberTier;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberTier.prototype, "tierLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberTier.prototype, "threshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MemberTier.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1000 }),
    __metadata("design:type", Number)
], MemberTier.prototype, "pointsMultiplier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1000 }),
    __metadata("design:type", Number)
], MemberTier.prototype, "redeemDiscountRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 500 }),
    __metadata("design:type", Number)
], MemberTier.prototype, "redeemCapRatio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MemberTier.prototype, "specialDiscountRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MemberTier.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MemberTier.prototype, "channels", void 0);
exports.MemberTier = MemberTier = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['tierLevel', 'channelId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], MemberTier);
//# sourceMappingURL=member-tier.entity.js.map