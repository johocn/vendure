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
exports.RechargeCardBatch = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let RechargeCardBatch = class RechargeCardBatch extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.RechargeCardBatch = RechargeCardBatch;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RechargeCardBatch.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RechargeCardBatch.prototype, "prefix", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RechargeCardBatch.prototype, "faceValue", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RechargeCardBatch.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RechargeCardBatch.prototype, "generatedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], RechargeCardBatch.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], RechargeCardBatch.prototype, "channels", void 0);
exports.RechargeCardBatch = RechargeCardBatch = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], RechargeCardBatch);
//# sourceMappingURL=recharge-card-batch.entity.js.map