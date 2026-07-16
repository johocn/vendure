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
exports.EmployeeCustomer = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("../pickup-location.entity");
let EmployeeCustomer = class EmployeeCustomer extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.EmployeeCustomer = EmployeeCustomer;
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], EmployeeCustomer.prototype, "customer", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], EmployeeCustomer.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeCustomer.prototype, "enterpriseName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeCustomer.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => pickup_location_entity_1.PickupLocation),
    (0, typeorm_1.JoinTable)({
        name: 'employee_customer_pickup_location',
        joinColumn: { name: 'employee_customer_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'pickup_location_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], EmployeeCustomer.prototype, "pickupLocations", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], EmployeeCustomer.prototype, "channel", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], EmployeeCustomer.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EmployeeCustomer.prototype, "verified", void 0);
exports.EmployeeCustomer = EmployeeCustomer = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], EmployeeCustomer);
//# sourceMappingURL=enterprise-customer.entity.js.map