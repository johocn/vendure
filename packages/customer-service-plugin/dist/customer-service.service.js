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
exports.CustomerServiceService = void 0;
// e:\code\vendure\packages\customer-service-plugin\src\customer-service.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const loggerCtx = 'CustomerServiceService';
/**
 * @description
 * 客服核心服务：全量订单查询、售后处理（代理 AfterSalesService）、异常订单跟进。
 *
 * 设计说明：
 * - findAllOrders 不过滤 staffId（客服可查全部订单），不过滤 active（含 Cancelled/Completed）
 * - 售后方法代理 AfterSalesService 的短名方法（approveRequest/rejectRequest/confirmReceive/processRefund）
 * - csNotes 为追加模式，不修改原有备注
 */
let CustomerServiceService = class CustomerServiceService {
    constructor(connection, orderService, afterSalesService) {
        this.connection = connection;
        this.orderService = orderService;
        this.afterSalesService = afterSalesService;
    }
    // ===== 订单查询 =====
    /**
     * 全量订单查询（无 staffId 过滤，支持 state/email/日期筛选 + 分页）
     */
    async findAllOrders(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        if (options === null || options === void 0 ? void 0 : options.customerEmail) {
            qb.andWhere('customer.emailAddress LIKE :email', {
                email: `%${options.customerEmail}%`,
            });
        }
        if (options === null || options === void 0 ? void 0 : options.startDate) {
            qb.andWhere('order.createdAt >= :start', { start: new Date(options.startDate) });
        }
        if (options === null || options === void 0 ? void 0 : options.endDate) {
            qb.andWhere('order.createdAt <= :end', { end: new Date(options.endDate) });
        }
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /**
     * 订单详情（聚合 order + 关联售后单 + 异常信息）
     */
    async findOrderDetail(ctx, orderId) {
        var _a, _b;
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'fulfillments',
        ]);
        if (!order)
            return null;
        // 查该订单关联的售后单（直接查 AfterSalesRequest 实体）
        const afterSalesRepo = this.connection.rawConnection.getRepository(after_sales_plugin_1.AfterSalesRequest);
        const afterSalesRequests = await afterSalesRepo.find({
            where: { orderId: orderId },
            relations: ['order', 'orderLine', 'customer'],
            order: { createdAt: 'DESC' },
        });
        // 异常信息（从 delivery customFields 读取）
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const exceptionInfo = cf.deliveryStatus === 'exception'
            ? {
                deliveryStatus: cf.deliveryStatus,
                exceptionType: cf.exceptionType,
                exceptionNote: cf.exceptionNote,
                exceptionPhotos: (_b = cf.exceptionPhotos) !== null && _b !== void 0 ? _b : [],
                deliveryStaffId: cf.deliveryStaffId,
            }
            : null;
        return { order, afterSalesRequests, exceptionInfo };
    }
    // ===== 售后处理（代理 AfterSalesService）=====
    // 注意：AfterSalesService 使用短方法名（非 GraphQL mutation 名）
    // GraphQL mutation 名: csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund
    // Service 方法名:      approveRequest / rejectRequest / confirmReceive / processRefund
    async approveAfterSales(ctx, id) {
        return this.afterSalesService.approveRequest(ctx, id);
    }
    async rejectAfterSales(ctx, id, reason) {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }
    async confirmReturnReceived(ctx, id) {
        return this.afterSalesService.confirmReceive(ctx, id);
    }
    async processRefund(ctx, id) {
        return this.afterSalesService.processRefund(ctx, id);
    }
    /**
     * 售后单列表查询（直接查 AfterSalesRequest 实体，支持 state 筛选 + 分页）
     */
    async findAfterSalesRequests(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, after_sales_plugin_1.AfterSalesRequest)
            .createQueryBuilder('request')
            .leftJoinAndSelect('request.order', 'order')
            .leftJoinAndSelect('request.orderLine', 'orderLine')
            .leftJoinAndSelect('request.customer', 'customer')
            .orderBy('request.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('request.state = :state', { state: options.state });
        }
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneAfterSalesRequest(ctx, id) {
        return this.afterSalesService.findOne(ctx, id);
    }
    // ===== 异常跟进 =====
    /**
     * 查询异常订单（customFields.deliveryStatus = 'exception'）
     */
    async findExceptionOrders(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            // shippingAddress 是嵌入字段不是关联关系，不能用 leftJoinAndSelect
            .where('order.customFields.deliveryStatus = :status', { status: 'exception' })
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.exceptionType) {
            qb.andWhere('order.customFields.exceptionType = :type', {
                type: options.exceptionType,
            });
        }
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [orders, totalItems] = await qb.getManyAndCount();
        const items = orders.map(order => {
            var _a, _b, _c;
            const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
            return {
                order,
                exceptionInfo: {
                    deliveryStatus: cf.deliveryStatus,
                    exceptionType: cf.exceptionType,
                    exceptionNote: cf.exceptionNote,
                    exceptionPhotos: (_b = cf.exceptionPhotos) !== null && _b !== void 0 ? _b : [],
                    deliveryStaffId: cf.deliveryStaffId,
                },
                csNotes: (_c = cf.csNotes) !== null && _c !== void 0 ? _c : [],
            };
        });
        return { items, totalItems };
    }
    /**
     * 追加客服备注（不修改原有备注）
     */
    async addExceptionNote(ctx, orderId, note) {
        var _a, _b;
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new core_1.UserInputError(`Order ${orderId} not found`);
        }
        const existingNotes = ((_b = (_a = order.customFields) === null || _a === void 0 ? void 0 : _a.csNotes) !== null && _b !== void 0 ? _b : []);
        const newNote = {
            content: note,
            createdBy: String(ctx.activeUserId),
            createdAt: new Date(),
        };
        core_1.Logger.info(`CS note added to order ${order.code} by user ${ctx.activeUserId}`, loggerCtx);
        return this.orderService.updateCustomFields(ctx, orderId, {
            csNotes: [...existingNotes, newNote],
        });
    }
};
exports.CustomerServiceService = CustomerServiceService;
exports.CustomerServiceService = CustomerServiceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        after_sales_plugin_1.AfterSalesService])
], CustomerServiceService);
