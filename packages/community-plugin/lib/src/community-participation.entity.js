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
exports.CommunityParticipation = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let CommunityParticipation = class CommunityParticipation extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CommunityParticipation = CommunityParticipation;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CommunityParticipation.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CommunityParticipation.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CommunityParticipation.prototype, "leaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }) // 参与成交额(分)
    ,
    __metadata("design:type", Number)
], CommunityParticipation.prototype, "subtotal", void 0);
exports.CommunityParticipation = CommunityParticipation = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CommunityParticipation);
//# sourceMappingURL=community-participation.entity.js.map