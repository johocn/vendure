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
exports.MessageDelivery = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let MessageDelivery = class MessageDelivery extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MessageDelivery = MessageDelivery;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MessageDelivery.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MessageDelivery.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], MessageDelivery.prototype, "deliveryStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MessageDelivery.prototype, "deliveryError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], MessageDelivery.prototype, "readAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MessageDelivery.prototype, "channels", void 0);
exports.MessageDelivery = MessageDelivery = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['messageId', 'customerId']),
    (0, typeorm_1.Index)(['customerId', 'readAt']),
    __metadata("design:paramtypes", [Object])
], MessageDelivery);
