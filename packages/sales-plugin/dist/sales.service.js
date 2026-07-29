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
exports.SalesService = exports.SalesReportResult = exports.SalesReportDaily = exports.SalesReportTopProduct = exports.SalesCreateOrderInput = exports.NewCustomerInput = exports.SalesOrderLineInput = void 0;
// e:\code\vendure\packages\sales-plugin\src\sales.service.ts
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const loggerCtx = 'SalesService';
let SalesOrderLineInput = class SalesOrderLineInput {
};
exports.SalesOrderLineInput = SalesOrderLineInput;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesOrderLineInput.prototype, "productVariantId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesOrderLineInput.prototype, "quantity", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Number)
], SalesOrderLineInput.prototype, "overwrittenPrice", void 0);
exports.SalesOrderLineInput = SalesOrderLineInput = __decorate([
    (0, graphql_1.InputType)()
], SalesOrderLineInput);
let NewCustomerInput = class NewCustomerInput {
};
exports.NewCustomerInput = NewCustomerInput;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], NewCustomerInput.prototype, "firstName", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], NewCustomerInput.prototype, "lastName", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], NewCustomerInput.prototype, "emailAddress", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], NewCustomerInput.prototype, "phoneNumber", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], NewCustomerInput.prototype, "customerType", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", Object)
], NewCustomerInput.prototype, "companyInfo", void 0);
exports.NewCustomerInput = NewCustomerInput = __decorate([
    (0, graphql_1.InputType)()
], NewCustomerInput);
let SalesCreateOrderInput = class SalesCreateOrderInput {
};
exports.SalesCreateOrderInput = SalesCreateOrderInput;
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], SalesCreateOrderInput.prototype, "customerId", void 0);
__decorate([
    (0, graphql_1.Field)(() => NewCustomerInput, { nullable: true }),
    __metadata("design:type", NewCustomerInput)
], SalesCreateOrderInput.prototype, "newCustomer", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SalesOrderLineInput]),
    __metadata("design:type", Array)
], SalesCreateOrderInput.prototype, "lines", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Object)
], SalesCreateOrderInput.prototype, "shippingAddress", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesCreateOrderInput.prototype, "shippingMethodId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesCreateOrderInput.prototype, "salesChannel", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], SalesCreateOrderInput.prototype, "note", void 0);
exports.SalesCreateOrderInput = SalesCreateOrderInput = __decorate([
    (0, graphql_1.InputType)()
], SalesCreateOrderInput);
let SalesReportTopProduct = class SalesReportTopProduct {
};
exports.SalesReportTopProduct = SalesReportTopProduct;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesReportTopProduct.prototype, "productVariantId", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesReportTopProduct.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportTopProduct.prototype, "quantitySold", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportTopProduct.prototype, "revenue", void 0);
exports.SalesReportTopProduct = SalesReportTopProduct = __decorate([
    (0, graphql_1.ObjectType)()
], SalesReportTopProduct);
let SalesReportDaily = class SalesReportDaily {
};
exports.SalesReportDaily = SalesReportDaily;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], SalesReportDaily.prototype, "date", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportDaily.prototype, "orderCount", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportDaily.prototype, "revenue", void 0);
exports.SalesReportDaily = SalesReportDaily = __decorate([
    (0, graphql_1.ObjectType)()
], SalesReportDaily);
let SalesReportResult = class SalesReportResult {
};
exports.SalesReportResult = SalesReportResult;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportResult.prototype, "totalOrders", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportResult.prototype, "totalRevenue", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportResult.prototype, "uniqueCustomers", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Number)
], SalesReportResult.prototype, "avgOrderValue", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SalesReportTopProduct]),
    __metadata("design:type", Array)
], SalesReportResult.prototype, "topProducts", void 0);
__decorate([
    (0, graphql_1.Field)(() => [SalesReportDaily]),
    __metadata("design:type", Array)
], SalesReportResult.prototype, "dailyBreakdown", void 0);
exports.SalesReportResult = SalesReportResult = __decorate([
    (0, graphql_1.ObjectType)()
], SalesReportResult);
let SalesService = class SalesService {
    constructor(connection, orderService, customerService, administratorService) {
        this.connection = connection;
        this.orderService = orderService;
        this.customerService = customerService;
        this.administratorService = administratorService;
    }
    /**
     * 销售开单：单事务完成建客户+加商品行+设地址+设配送+写 salesStaffId
     */
    async createOrder(ctx, input) {
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b, _c, _d, _e;
            // 1. 解析 customerId
            let customerId = input.customerId;
            if (!customerId && input.newCustomer) {
                const nc = input.newCustomer;
                // emailAddress 占位策略
                const emailAddress = nc.emailAddress || `${nc.phoneNumber}@placeholder.local`;
                const created = await this.customerService.create(txCtx, {
                    firstName: nc.firstName,
                    lastName: nc.lastName,
                    emailAddress,
                    phoneNumber: nc.phoneNumber,
                    customFields: {
                        customerType: nc.customerType,
                        companyInfo: nc.companyInfo,
                        salesStaffId: String(ctx.activeUserId),
                        customerTags: [],
                    },
                });
                if ('errorCode' in created) {
                    throw new core_1.UserInputError((_a = created.message) !== null && _a !== void 0 ? _a : created.errorCode);
                }
                customerId = String(created.id);
            }
            if (!customerId) {
                throw new core_1.UserInputError('Either customerId or newCustomer must be provided');
            }
            // 2. 查 customer 拿 userId
            const customer = await this.customerService.findOne(txCtx, customerId, ['user']);
            if (!customer || !customer.user) {
                throw new core_1.UserInputError(`Customer ${customerId} not found or has no user`);
            }
            // 3. 创建 Order
            const order = await this.orderService.create(txCtx, customer.user.id);
            // 4. 加商品行（含 overwrittenPrice）
            const items = input.lines.map(line => ({
                productVariantId: line.productVariantId,
                quantity: line.quantity,
                customFields: line.overwrittenPrice
                    ? {
                        overwrittenPrice: line.overwrittenPrice,
                        originalPrice: null,
                        modifiedBy: String(ctx.activeUserId),
                        modifiedAt: new Date(),
                    }
                    : {},
            }));
            const addResult = await this.orderService.addItemsToOrder(txCtx, order.id, items);
            if ((_b = addResult.errorResults) === null || _b === void 0 ? void 0 : _b.length) {
                throw new core_1.UserInputError((_c = addResult.errorResults[0].message) !== null && _c !== void 0 ? _c : 'Add items failed');
            }
            let updatedOrder = addResult.order;
            // 5. 设地址
            updatedOrder = await this.orderService.setShippingAddress(txCtx, updatedOrder.id, input.shippingAddress);
            // 6. 设配送方式
            const shippingResult = await this.orderService.setShippingMethod(txCtx, updatedOrder.id, [input.shippingMethodId]);
            if ('errorCode' in shippingResult) {
                throw new core_1.UserInputError((_d = shippingResult.message) !== null && _d !== void 0 ? _d : 'Set shipping method failed');
            }
            updatedOrder = shippingResult;
            // 7. 写 Order customFields
            updatedOrder = await this.orderService.updateCustomFields(txCtx, updatedOrder.id, {
                salesStaffId: String(ctx.activeUserId),
                salesChannel: input.salesChannel,
                salesNote: (_e = input.note) !== null && _e !== void 0 ? _e : null,
            });
            core_1.Logger.info(`Sales order created: ${updatedOrder.code} by user ${ctx.activeUserId}`, loggerCtx);
            return updatedOrder;
        });
    }
    /**
     * 查询我的销售单（按 salesStaffId 过滤）
     */
    async findMySales(ctx, options) {
        var _a, _b;
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'lines')
            .where('order.customFields.salesStaffId = :staffId', { staffId: String(ctx.activeUserId) })
            .andWhere('(order.active = :active OR order.state IN (:...cancelledStates))', {
            active: true,
            cancelledStates: ['Cancelled', 'Completed'],
        });
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /**
     * 查询全部销售单（manager+）
     */
    async findAllSales(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.customFields.salesStaffId IS NOT NULL')
            .andWhere('(order.active = :active OR order.state IN (:...cancelledStates))', {
            active: true,
            cancelledStates: ['Cancelled', 'Completed'],
        });
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        if (options === null || options === void 0 ? void 0 : options.staffId) {
            qb.andWhere('order.customFields.salesStaffId = :staffId', { staffId: options.staffId });
        }
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /**
     * 修改订单行价格
     */
    async modifyOrderLinePrice(ctx, orderLineId, newPrice) {
        var _a, _b, _c;
        if (!ctx.activeUserId) {
            throw new core_1.ForbiddenError();
        }
        const orderLineRepo = this.connection.getRepository(ctx, 'OrderLine');
        const orderLine = await orderLineRepo.findOne({
            where: { id: orderLineId },
            relations: ['order'],
        });
        if (!orderLine || !orderLine.order) {
            throw new core_1.UserInputError(`OrderLine ${orderLineId} not found`);
        }
        const order = orderLine.order;
        await this.connection
            .getRepository(ctx, 'OrderLine')
            .update({ id: orderLineId }, {
            customFields: {
                overwrittenPrice: newPrice,
                originalPrice: (_b = (_a = orderLine.productVariant) === null || _a === void 0 ? void 0 : _a.listPrice) !== null && _b !== void 0 ? _b : null,
                modifiedBy: String(ctx.activeUserId),
                modifiedAt: new Date(),
            },
        });
        const updatedOrder = await this.orderService.adjustOrderLine(ctx, order.id, orderLineId, orderLine.quantity, { overwrittenPrice: newPrice, modifiedBy: String(ctx.activeUserId), modifiedAt: new Date() });
        if ('errorCode' in updatedOrder) {
            throw new core_1.UserInputError((_c = updatedOrder.message) !== null && _c !== void 0 ? _c : 'Adjust order line failed');
        }
        return updatedOrder;
    }
    /**
     * 取消订单（仅 AddingItems 状态）
     */
    async cancelOrder(ctx, orderId, reason) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new core_1.UserInputError(`Order ${orderId} not found`);
        }
        if (order.state !== 'AddingItems') {
            throw new core_1.UserInputError(`Order state ${order.state} cannot be cancelled`);
        }
        const result = await this.orderService.transitionToState(ctx, orderId, 'Cancelled');
        if ('errorCode' in result) {
            throw new core_1.UserInputError((_a = result.message) !== null && _a !== void 0 ? _a : 'Cancel failed');
        }
        return result;
    }
    /**
     * 生成业绩报表
     */
    async buildReport(ctx, staffId, range) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .where('order.customFields.salesStaffId IS NOT NULL')
            .andWhere('order.createdAt BETWEEN :start AND :end', {
            start: range.start,
            end: range.end,
        });
        if (staffId) {
            qb.andWhere('order.customFields.salesStaffId = :staffId', { staffId });
        }
        const orders = await qb.getMany();
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => { var _a; return sum + ((_a = o.total) !== null && _a !== void 0 ? _a : 0); }, 0);
        const customerIds = new Set(orders.map(o => { var _a; return (_a = o.customer) === null || _a === void 0 ? void 0 : _a.id; }).filter(Boolean));
        const uniqueCustomers = customerIds.size;
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        const productMap = new Map();
        for (const o of orders) {
            for (const line of (_a = o.lines) !== null && _a !== void 0 ? _a : []) {
                const variantId = String((_c = (_b = line.productVariant) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : '');
                const name = (_e = (_d = line.productVariant) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : 'Unknown';
                const quantitySold = line.quantity;
                const revenue = ((_f = line.unitPrice) !== null && _f !== void 0 ? _f : 0) * line.quantity;
                const existing = (_g = productMap.get(variantId)) !== null && _g !== void 0 ? _g : { name, quantitySold: 0, revenue: 0 };
                existing.quantitySold += quantitySold;
                existing.revenue += revenue;
                productMap.set(variantId, existing);
            }
        }
        const topProducts = Array.from(productMap.entries())
            .map(([productVariantId, v]) => (Object.assign({ productVariantId }, v)))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
        const dailyMap = new Map();
        for (const o of orders) {
            const date = o.createdAt.toISOString().slice(0, 10);
            const existing = (_h = dailyMap.get(date)) !== null && _h !== void 0 ? _h : { orderCount: 0, revenue: 0 };
            existing.orderCount++;
            existing.revenue += (_j = o.total) !== null && _j !== void 0 ? _j : 0;
            dailyMap.set(date, existing);
        }
        const dailyBreakdown = Array.from(dailyMap.entries())
            .map(([date, v]) => (Object.assign({ date }, v)))
            .sort((a, b) => a.date.localeCompare(b.date));
        return {
            totalOrders,
            totalRevenue,
            uniqueCustomers,
            avgOrderValue,
            topProducts,
            dailyBreakdown,
        };
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.CustomerService,
        core_1.AdministratorService])
], SalesService);
