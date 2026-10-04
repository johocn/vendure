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
exports.RiderEarning = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let RiderEarning = class RiderEarning extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.RiderEarning = RiderEarning;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Object)
], RiderEarning.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Object)
], RiderEarning.prototype, "riderCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], RiderEarning.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], RiderEarning.prototype, "tip", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'credited' }),
    __metadata("design:type", String)
], RiderEarning.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Object)
], RiderEarning.prototype, "channelId", void 0);
exports.RiderEarning = RiderEarning = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], RiderEarning);
//# sourceMappingURL=rider-earning.entity.js.map