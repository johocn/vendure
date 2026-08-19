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
exports.DeliveryService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const loggerCtx = 'DeliveryService';
/**
 * @description
 * 送货核心服务：负责送货任务的查询、状态流转与 Fulfillment 推进。
 *
 * 设计说明：
 * - `deliveryStaffId` 中存储的是 User ID（字符串），与 `ctx.activeUserId` 直接比较。
 * - 状态机：assigned → in_progress → delivered；任意状态可切到 exception。
 * - markDelivered 后将订单上 state=Shipped 的 Fulfillment 推进到 Delivered。
 * - withTransaction 内部必须使用回调的 txCtx，避免跨事务。
 */
let DeliveryService = class DeliveryService {
    constructor(connection, orderService, fulfillmentService) {
        this.connection = connection;
        this.orderService = orderService;
        this.fulfillmentService = fulfillmentService;
    }
    /**
     * 查询某送货员名下的订单。staffId 应为 User ID 字符串。
     * 仅返回 customFields.deliveryStatus 非空（即已被指派）的订单。
     */
    async findMyDeliveries(ctx, staffId, status) {
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingLines', 'shippingLines')
            .where('order.customFields.deliveryStaffId = :staffId', { staffId })
            .andWhere('order.customFields.deliveryStatus IS NOT NULL');
        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :status', { status });
        }
        qb.orderBy('order.createdAt', 'DESC');
        return qb.getMany();
    }
    /**
     * 管理员查询全部送货订单（任何已被指派的订单）。
     */
    async findAllDeliveries(ctx, status) {
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingLines', 'shippingLines')
            .where('order.customFields.deliveryStatus IS NOT NULL');
        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :status', { status });
        }
        qb.orderBy('order.createdAt', 'DESC');
        return qb.getMany();
    }
    /**
     * 开始配送：assigned → in_progress。
     * 仅订单的指派送货员可调用。
     */
    async startDelivery(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);
        this.assertStatus(order, constants_1.DeliveryStatus.Assigned, '开始配送');
        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStatus: constants_1.DeliveryStatus.InProgress,
        });
        core_1.Logger.info(`Order ${order.code} delivery started by staff ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }
    /**
     * 送达签收：in_progress → delivered，并推进 Fulfillment Shipped → Delivered。
     */
    async markDelivered(ctx, orderId, photos, note) {
        if (!photos || photos.length === 0) {
            throw new core_1.UserInputError('At least one photo is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);
        this.assertStatus(order, constants_1.DeliveryStatus.InProgress, '标记送达');
        await this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            await this.orderService.updateCustomFields(txCtx, orderId, {
                deliveryStatus: constants_1.DeliveryStatus.Delivered,
                deliveredAt: new Date(),
                deliveryPhotos: photos,
                deliveryNote: note !== null && note !== void 0 ? note : '',
            });
            // 推进 Shipped → Delivered（事务内）
            const orderWithFulfillments = await this.orderService.findOne(txCtx, orderId, [
                'fulfillments',
            ]);
            const fulfillments = (_a = orderWithFulfillments === null || orderWithFulfillments === void 0 ? void 0 : orderWithFulfillments.fulfillments) !== null && _a !== void 0 ? _a : [];
            for (const f of fulfillments) {
                if (f.state === 'Shipped') {
                    const result = await this.fulfillmentService.transitionToState(txCtx, f.id, 'Delivered');
                    if ('transitionError' in result) {
                        core_1.Logger.warn(`Fulfillment ${f.id} transition to Delivered failed: ${result.transitionError}`, loggerCtx);
                    }
                }
            }
        });
        core_1.Logger.info(`Order ${order.code} marked delivered by staff ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }
    /**
     * 自提点核销（交付到点）：pickup 订单交付后确认已取货。
     *
     * 与 markDelivered（配送员签收）不同，自提场景无配送员指派链路，
     * 由店员/管理员在自提点交付后调用。校验：
     * - 订单为 pickup 类型（deliveryType === 'pickup'）且已选自提点
     * - 存在 Shipped 的 Fulfillment
     * 完成后：标记 pickupClaimed=true，并将所有 Shipped Fulfillment 推进到 Delivered。
     */
    async confirmPickupHandover(ctx, orderId) {
        var _a, _b;
        const order = await this.getOrderOrThrow(ctx, orderId);
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.deliveryType !== 'pickup') {
            throw new core_1.IllegalOperationError(`Cannot confirm pickup handover: order deliveryType is "${(_b = cf.deliveryType) !== null && _b !== void 0 ? _b : '(none)'}", expected "pickup"`);
        }
        // relation 自定义字段（selectedPickupLocationId）不随 Order 实体加载（未设 eager），
        // 必须用 QueryBuilder 关联查询读取 FK 值（与 Vendure 官方 CustomFieldRelationResolverService 同法，跨库通用）
        const row = await this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('o')
            .leftJoin('o.customFields.selectedPickupLocationId', 'pl')
            .select('pl.id', 'pickupLocationId')
            .where('o.id = :id', { id: orderId })
            .getRawOne();
        if (!(row === null || row === void 0 ? void 0 : row.pickupLocationId)) {
            throw new core_1.IllegalOperationError('Cannot confirm pickup handover: no pickup location selected on order');
        }
        await this.connection.withTransaction(ctx, async (txCtx) => {
            var _a;
            await this.orderService.updateCustomFields(txCtx, orderId, {
                pickupClaimed: true,
                deliveredAt: new Date(),
            });
            const orderWithFulfillments = await this.orderService.findOne(txCtx, orderId, [
                'fulfillments',
            ]);
            const fulfillments = (_a = orderWithFulfillments === null || orderWithFulfillments === void 0 ? void 0 : orderWithFulfillments.fulfillments) !== null && _a !== void 0 ? _a : [];
            let advanced = false;
            for (const f of fulfillments) {
                if (f.state === 'Shipped') {
                    const result = await this.fulfillmentService.transitionToState(txCtx, f.id, 'Delivered');
                    if ('transitionError' in result) {
                        core_1.Logger.warn(`Fulfillment ${f.id} transition to Delivered failed: ${result.transitionError}`, loggerCtx);
                    }
                    else {
                        advanced = true;
                    }
                }
            }
            if (!advanced) {
                core_1.Logger.warn(`confirmPickupHandover: order ${order.code} has no Shipped fulfillment to advance`, loggerCtx);
            }
        });
        core_1.Logger.info(`Order ${order.code} pickup handover confirmed by user ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }
    /**
     * 异常上报：写入异常字段并将状态置为 exception。
     * 不变更 Fulfillment 状态（保持 Shipped，待人工处理）。
     */
    async reportException(ctx, orderId, type, photos, note) {
        if (!Object.values(constants_1.ExceptionType).includes(type)) {
            throw new core_1.UserInputError(`Invalid exception type: ${type}`);
        }
        if (!photos || photos.length === 0) {
            throw new core_1.UserInputError('At least one photo is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        this.assertOwnership(order, ctx);
        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStatus: constants_1.DeliveryStatus.Exception,
            exceptionType: type,
            exceptionPhotos: photos,
            exceptionNote: note !== null && note !== void 0 ? note : '',
        });
        core_1.Logger.info(`Order ${order.code} exception reported by staff ${ctx.activeUserId}: ${type}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }
    /**
     * 改派：更换送货员并重置状态为 assigned。
     * 通常由 manager/super-admin 调用，不校验 ownership。
     */
    async reassignDelivery(ctx, orderId, newStaffId) {
        var _a;
        if (!newStaffId) {
            throw new core_1.UserInputError('newStaffId is required');
        }
        const order = await this.getOrderOrThrow(ctx, orderId);
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (cf.deliveryStaffId === newStaffId) {
            throw new core_1.UserInputError('Order is already assigned to this staff');
        }
        await this.orderService.updateCustomFields(ctx, orderId, {
            deliveryStaffId: newStaffId,
            deliveryStatus: constants_1.DeliveryStatus.Assigned,
            assignedAt: new Date(),
            deliveredAt: null,
            deliveryPhotos: [],
            deliveryNote: '',
            exceptionType: null,
            exceptionNote: '',
            exceptionPhotos: [],
        });
        core_1.Logger.info(`Order ${order.code} reassigned to staff ${newStaffId} by ${ctx.activeUserId}`, loggerCtx);
        return this.reloadOrder(ctx, orderId);
    }
    // ===== Helpers =====
    async getOrderOrThrow(ctx, orderId) {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new core_1.UserInputError(`Order with id ${orderId} not found`);
        }
        return order;
    }
    async reloadOrder(ctx, orderId) {
        const refreshed = await this.orderService.findOne(ctx, orderId, ['fulfillments']);
        if (!refreshed) {
            throw new core_1.UserInputError(`Order with id ${orderId} not found after update`);
        }
        return refreshed;
    }
    /**
     * 校验当前用户是指派送货员。deliveryStaffId 存储 User ID 字符串。
     */
    assertOwnership(order, ctx) {
        var _a;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const staffId = cf.deliveryStaffId;
        if (!ctx.activeUserId || !staffId || String(ctx.activeUserId) !== String(staffId)) {
            throw new core_1.ForbiddenError();
        }
    }
    assertStatus(order, expected, action) {
        var _a;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const current = cf.deliveryStatus;
        if (current !== expected) {
            throw new core_1.IllegalOperationError(`Cannot ${action}: order delivery status is "${current}", expected "${expected}"`);
        }
    }
};
exports.DeliveryService = DeliveryService;
exports.DeliveryService = DeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.FulfillmentService])
], DeliveryService);
