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
exports.RechargeCard = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let RechargeCard = class RechargeCard extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.RechargeCard = RechargeCard;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], RechargeCard.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RechargeCard.prototype, "pinHash", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RechargeCard.prototype, "faceValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'unused' }),
    __metadata("design:type", String)
], RechargeCard.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], RechargeCard.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer, { nullable: true, onDelete: 'SET NULL' }),
    __metadata("design:type", Object)
], RechargeCard.prototype, "redeemedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], RechargeCard.prototype, "redeemedByCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], RechargeCard.prototype, "redeemedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], RechargeCard.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], RechargeCard.prototype, "channels", void 0);
exports.RechargeCard = RechargeCard = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], RechargeCard);
//# sourceMappingURL=recharge-card.entity.js.map