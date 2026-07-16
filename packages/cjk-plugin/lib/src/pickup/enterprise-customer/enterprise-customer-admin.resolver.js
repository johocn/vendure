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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeCustomerAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const enterprise_customer_service_1 = require("./enterprise-customer.service");
const pickup_permissions_1 = require("../pickup-permissions");
let EmployeeCustomerAdminResolver = class EmployeeCustomerAdminResolver {
    constructor(employeeCustomerService) {
        this.employeeCustomerService = employeeCustomerService;
    }
    async employeeCustomers(ctx) {
        return this.employeeCustomerService.findAll(ctx);
    }
    async employeeCustomer(ctx, id) {
        return this.employeeCustomerService.findOne(ctx, id);
    }
    async employeeCustomersByCustomer(ctx, customerId) {
        return this.employeeCustomerService.findByCustomer(ctx, customerId);
    }
    async createEmployeeCustomer(ctx, input) {
        return this.employeeCustomerService.create(ctx, input);
    }
    async updateEmployeeCustomer(ctx, input) {
        return this.employeeCustomerService.update(ctx, input);
    }
    async deleteEmployeeCustomer(ctx, id) {
        return this.employeeCustomerService.delete(ctx, id);
    }
    async bindEnterprisePickupLocations(ctx, id, pickupLocationIds) {
        return this.employeeCustomerService.update(ctx, { id, pickupLocationIds });
    }
    async verifyEmployeeCustomer(ctx, id) {
        return this.employeeCustomerService.verify(ctx, id);
    }
};
exports.EmployeeCustomerAdminResolver = EmployeeCustomerAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.ReadEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "employeeCustomers", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.ReadEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "employeeCustomer", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.ReadEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "employeeCustomersByCustomer", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.CreateEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "createEmployeeCustomer", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.UpdateEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "updateEmployeeCustomer", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.DeleteEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "deleteEmployeeCustomer", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.BindPickupLocation),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('pickupLocationIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "bindEnterprisePickupLocations", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(pickup_permissions_1.PickupPermissions.VerifyEmployeeCustomer),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EmployeeCustomerAdminResolver.prototype, "verifyEmployeeCustomer", null);
exports.EmployeeCustomerAdminResolver = EmployeeCustomerAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [enterprise_customer_service_1.EmployeeCustomerService])
], EmployeeCustomerAdminResolver);
//# sourceMappingURL=enterprise-customer-admin.resolver.js.map