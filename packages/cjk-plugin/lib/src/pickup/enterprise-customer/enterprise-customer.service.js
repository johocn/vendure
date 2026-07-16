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
exports.EmployeeCustomerService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const enterprise_customer_entity_1 = require("./enterprise-customer.entity");
const pickup_location_service_1 = require("../pickup-location.service");
let EmployeeCustomerService = class EmployeeCustomerService {
    constructor(connection, pickupLocationService) {
        this.connection = connection;
        this.pickupLocationService = pickupLocationService;
    }
    async findAll(ctx) {
        return this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .leftJoinAndSelect('ec.customer', 'customer')
            .where('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getMany();
    }
    async findByCustomer(ctx, customerId) {
        return this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.customerId = :customerId', { customerId })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getMany();
    }
    async findOne(ctx, id) {
        const result = await this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.id = :id', { id })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result !== null && result !== void 0 ? result : undefined;
    }
    async create(ctx, input) {
        var _a;
        const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
        const allowedIds = allowedLocations.map(l => l.id);
        const invalidIds = input.pickupLocationIds.filter(id => !allowedIds.includes(id));
        if (invalidIds.length > 0) {
            throw new core_1.UserInputError('部分自提点不在当前租户可见范围内');
        }
        const ec = new enterprise_customer_entity_1.EmployeeCustomer();
        ec.customerId = input.customerId;
        ec.enterpriseName = input.enterpriseName;
        ec.employeeId = input.employeeId;
        ec.channelId = ctx.channelId;
        ec.verified = (_a = input.verified) !== null && _a !== void 0 ? _a : false;
        ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds.includes(l.id));
        return this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer).save(ec);
    }
    async update(ctx, input) {
        const ec = await this.findOne(ctx, input.id);
        if (!ec)
            throw new core_1.UserInputError('EmployeeCustomer not found');
        if (input.enterpriseName != null)
            ec.enterpriseName = input.enterpriseName;
        if (input.employeeId != null)
            ec.employeeId = input.employeeId;
        if (input.verified != null)
            ec.verified = input.verified;
        if (input.pickupLocationIds != null) {
            const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
            ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds.includes(l.id));
        }
        return this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer).save(ec);
    }
    async delete(ctx, id) {
        const ec = await this.findOne(ctx, id);
        if (!ec)
            return false;
        await this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer).remove(ec);
        return true;
    }
    async verify(ctx, id) {
        const ec = await this.findOne(ctx, id);
        if (!ec)
            throw new core_1.UserInputError('EmployeeCustomer not found');
        ec.verified = true;
        return this.connection.getRepository(ctx, enterprise_customer_entity_1.EmployeeCustomer).save(ec);
    }
};
exports.EmployeeCustomerService = EmployeeCustomerService;
exports.EmployeeCustomerService = EmployeeCustomerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        pickup_location_service_1.PickupLocationService])
], EmployeeCustomerService);
//# sourceMappingURL=enterprise-customer.service.js.map