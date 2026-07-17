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
exports.CustomerBalance = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let CustomerBalance = class CustomerBalance extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CustomerBalance = CustomerBalance;
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], CustomerBalance.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CustomerBalance.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], CustomerBalance.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CustomerBalance.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CustomerBalance.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CustomerBalance.prototype, "frozenBalance", void 0);
exports.CustomerBalance = CustomerBalance = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Unique)(['customer', 'channel']),
    __metadata("design:paramtypes", [Object])
], CustomerBalance);
//# sourceMappingURL=customer-balance.entity.js.map