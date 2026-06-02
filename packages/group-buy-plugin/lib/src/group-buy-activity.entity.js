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
exports.GroupBuyActivity = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let GroupBuyActivity = class GroupBuyActivity extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.GroupBuyActivity = GroupBuyActivity;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GroupBuyActivity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GroupBuyActivity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "targetCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "currentCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "maxCount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GroupBuyActivity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], GroupBuyActivity.prototype, "startAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], GroupBuyActivity.prototype, "endAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "groupPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], GroupBuyActivity.prototype, "leaderDiscount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'discount' }),
    __metadata("design:type", String)
], GroupBuyActivity.prototype, "leaderRewardType", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], GroupBuyActivity.prototype, "rewardRules", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], GroupBuyActivity.prototype, "autoConfirm", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], GroupBuyActivity.prototype, "allowJoinAfterComplete", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], GroupBuyActivity.prototype, "channels", void 0);
exports.GroupBuyActivity = GroupBuyActivity = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], GroupBuyActivity);
//# sourceMappingURL=group-buy-activity.entity.js.map