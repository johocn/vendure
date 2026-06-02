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
exports.PickupLocation = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
class CustomPickupLocationFields {
}
let PickupLocation = class PickupLocation extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PickupLocation = PickupLocation;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PickupLocation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PickupLocation.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PickupLocation.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PickupLocation.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PickupLocation.prototype, "businessHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PickupLocation.prototype, "coordinates", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PickupLocation.prototype, "partner", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], PickupLocation.prototype, "channels", void 0);
__decorate([
    (0, typeorm_1.Column)(() => CustomPickupLocationFields),
    __metadata("design:type", CustomPickupLocationFields)
], PickupLocation.prototype, "customFields", void 0);
exports.PickupLocation = PickupLocation = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PickupLocation);
//# sourceMappingURL=pickup-location.entity.js.map