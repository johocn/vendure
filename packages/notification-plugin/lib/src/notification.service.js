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
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const shop_plugin_1 = require("@vendure/shop-plugin");
const constants_1 = require("./constants");
const inbox_message_entity_1 = require("./inbox-message.entity");
/**
 * 消息触达编排与站内信存储。
 * deliver(frame)：站内信真实落库（inboxEnabled 开关），再经 notifier 外发（微信，失败不阻断）。
 */
let NotificationService = class NotificationService {
    constructor(options, connection, orderService, customerService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.customerService = customerService;
        this.notifier = {};
    }
    /** 由插件 onApplicationBootstrap 注入 notifier（避免 DI 环）。 */
    init(notifier) {
        this.notifier = notifier;
    }
    // ---------- 站内信存储 ----------
    /** 写一条站内信，返回落库实体。 */
    createInbox(ctx, frame, opts) {
        var _a, _b, _c;
        const msg = new inbox_message_entity_1.InboxMessage({
            channelId: ctx.channelId,
            recipientType: opts.recipientType,
            customerId: (_a = opts.customerId) !== null && _a !== void 0 ? _a : null,
            administratorId: (_b = opts.administratorId) !== null && _b !== void 0 ? _b : null,
            scene: frame.scene,
            title: frame.title,
            content: frame.content,
            link: (_c = frame.link) !== null && _c !== void 0 ? _c : null,
            isRead: false,
        });
        return this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).save(msg);
    }
    /** C 端收件箱：当前顾客的站内信（按 id 倒序）。 */
    async listCustomerInbox(ctx, options) {
        var _a, _b;
        const customer = await this.requireCustomer(ctx);
        const skip = (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0;
        const take = (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50;
        const where = { customerId: customer.id, channelId: ctx.channelId };
        const [items, totalItems] = await this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).findAndCount({
            where, order: { id: 'DESC' }, skip, take,
        });
        return { items, totalItems };
    }
    /** 店主/平台收件箱：当前登录管理员。 */
    async listAdminInbox(ctx, options) {
        var _a, _b;
        if (!ctx.activeUserId)
            throw new core_1.UnauthorizedError();
        const admin = await this.administratorForUser(ctx.activeUserId);
        const skip = (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0;
        const take = (_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50;
        const where = { administratorId: admin.id, channelId: ctx.channelId };
        const [items, totalItems] = await this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).findAndCount({
            where, order: { id: 'DESC' }, skip, take,
        });
        return { items, totalItems };
    }
    /** 未读数。 */
    async unreadCount(ctx, t = 'customer') {
        if (t === 'customer') {
            const c = await this.requireCustomer(ctx);
            return this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).count({
                where: { customerId: c.id, isRead: false, channelId: ctx.channelId },
            });
        }
        if (!ctx.activeUserId)
            throw new core_1.UnauthorizedError();
        const admin = await this.administratorForUser(ctx.activeUserId);
        return this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).count({
            where: { administratorId: admin.id, isRead: false, channelId: ctx.channelId },
        });
    }
    /** 置已读（仅本人）。 */
    async markRead(ctx, id, t) {
        const msg = await this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).findOne({
            where: { id: Number(id) },
        });
        if (!msg)
            throw new core_1.EntityNotFoundError('InboxMessage', id);
        if (t === 'customer') {
            const c = await this.requireCustomer(ctx);
            if (msg.customerId !== c.id)
                throw new core_1.EntityNotFoundError('InboxMessage', id);
        }
        else {
            if (!ctx.activeUserId)
                throw new core_1.UnauthorizedError();
            const admin = await this.administratorForUser(ctx.activeUserId);
            if (msg.administratorId !== admin.id)
                throw new core_1.EntityNotFoundError('InboxMessage', id);
        }
        msg.isRead = true;
        msg.readAt = new Date();
        return this.connection.getRepository(ctx, inbox_message_entity_1.InboxMessage).save(msg);
    }
    // ---------- 触发场景 ----------
    /** 订单状态迁移 → 买家/店主站内信 + 微信。 */
    async onOrderStateTransition(ctx, orderId, toState) {
        var _a;
        const sceneMap = {
            PaymentSettled: 'order_paid',
            Shipped: 'order_shipped',
            Delivered: 'order_delivered',
            Completed: 'order_completed',
        };
        const scene = sceneMap[toState];
        if (!scene)
            return;
        // 传 relations 会覆盖默认值，必须显式带上 lines + lines.productVariant，
        // 否则 order.lines 为空，getOrderShopIds 无法反查到商品归属店铺（shop_new_order 永不触发）。
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer', 'customFields', 'lines', 'lines.productVariant',
        ]);
        if (!order)
            return;
        const title = this.titleFor(scene);
        const content = `您的订单 ${order.code} ${this.descFor(scene)}。`;
        if ((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) {
            const frame = {
                scene, title, content, recipientType: 'customer',
                customerId: order.customer.id, templateParams: { orderCode: order.code },
            };
            await this.deliver(ctx, frame);
        }
        if (toState === 'PaymentSettled') {
            await this.notifyShopOwners(ctx, order, `新订单 ${order.code}`, `您有一笔新订单 ${order.code}，请尽快处理。`);
        }
    }
    /** 退款 Settled → 买家到账通知。 */
    async onRefundSettled(ctx, orderId, refundTotalWithTax) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId, ['customer']);
        if (!order || !((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id))
            return;
        await this.deliver(ctx, {
            scene: 'refund_settled',
            title: '退款到账',
            content: `订单 ${order.code} 退款 ¥${(refundTotalWithTax / 100).toFixed(2)} 已到账。`,
            recipientType: 'customer',
            customerId: order.customer.id,
            templateParams: { orderCode: order.code, amount: String(refundTotalWithTax) },
        });
    }
    // ---------- 工具 ----------
    async deliver(ctx, frame) {
        if (frame.recipientType === 'customer') {
            if (this.options.inboxEnabled !== false && frame.customerId) {
                await this.createInbox(ctx, frame, { recipientType: 'customer', customerId: Number(frame.customerId) });
            }
        }
        try {
            if (this.notifier.send) {
                await this.notifier.send(frame);
            }
        }
        catch (e) {
            core_1.Logger.warn(`notifier error: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
        }
    }
    /** 涉及店铺的店主收件箱推送（沿 Product.shopId → Shop.administratorId）。 */
    async notifyShopOwners(ctx, order, title, content) {
        const shopIds = await this.getOrderShopIds(ctx, order);
        if (shopIds.length === 0)
            return;
        const shops = await this.connection.getRepository(ctx, shop_plugin_1.Shop).find({
            where: { id: (0, typeorm_1.In)(shopIds) },
        });
        for (const shop of shops) {
            if (shop.administratorId == null)
                continue;
            await this.createInbox(ctx, { scene: 'shop_new_order', title, content, recipientType: 'admin' }, {
                recipientType: 'admin', administratorId: shop.administratorId,
            });
        }
    }
    /** 订单行 → productVariant.productId → Product.shopId 反查去重（对齐 address-plugin getOrderShopIds）。 */
    async getOrderShopIds(ctx, order) {
        var _a;
        const productIds = [...new Set(((_a = order.lines) !== null && _a !== void 0 ? _a : [])
                .map((l) => { var _a; return Number((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.productId) || Number(l.productId); })
                .filter((id) => id > 0))];
        if (productIds.length === 0)
            return [];
        const products = await this.connection.getRepository(ctx, core_1.Product).find({
            where: { id: (0, typeorm_1.In)(productIds) },
        });
        return [...new Set(products.map((p) => { var _a; return Number((_a = p.customFields) === null || _a === void 0 ? void 0 : _a.shopId); }).filter((id) => id > 0))];
    }
    titleFor(scene) {
        var _a;
        const m = {
            order_paid: '支付成功', order_shipped: '订单已发货', order_delivered: '订单已送达', order_completed: '交易完成',
        };
        return (_a = m[scene]) !== null && _a !== void 0 ? _a : '订单通知';
    }
    descFor(scene) {
        var _a;
        const m = {
            order_paid: '已支付成功', order_shipped: '已发货', order_delivered: '已送达', order_completed: '已完成',
        };
        return (_a = m[scene]) !== null && _a !== void 0 ? _a : '状态已更新';
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        return customer;
    }
    /** 按登录 User 主键反查 Administrator（Administrator.user 关系）。 */
    async administratorForUser(userId) {
        const repo = this.connection.rawConnection.getRepository(core_1.Administrator);
        const a = await repo.findOne({ where: { user: { id: Number(userId) } } });
        if (!a)
            throw new core_1.EntityNotFoundError('Administrator', userId);
        return a;
    }
    // ---------- 售后状态通知（迭代三期，通知矩阵见三期设计 §一） ----------
    /** 售后状态迁移 → 顾客/商家站内信。任何失败仅告警，绝不阻断主流程。 */
    async onAfterSalesStateTransition(ctx, e) {
        var _a, _b, _c, _d;
        try {
            const customerLink = `/account/after-sales/${e.requestId}`;
            const cTitles = {
                Approved: '售后审核通过',
                Received: '商家已收货',
                Refunded: '退款已到账',
                RefundFailed: '退款异常',
            };
            const cContents = {
                Approved: '您的售后申请已审核通过，请按寄回地址寄回商品。',
                Received: '商家已确认收到您的退货，退款将原路退回。',
                Refunded: '您的退款已原路退回，请留意账户变动。',
                RefundFailed: '退款处理出现异常，商家正在处理，请耐心等待。',
            };
            // ---- 顾客侧 ----
            if (e.customerId != null) {
                if (e.toState === 'Rejected') {
                    const req = await this.afterSalesRequestRow(e.requestId);
                    const reason = ((_a = req === null || req === void 0 ? void 0 : req.rejectReason) !== null && _a !== void 0 ? _a : '').slice(0, 50);
                    await this.deliver(ctx, {
                        scene: 'after_sales', title: '售后被拒绝',
                        content: `您的售后申请被拒绝${reason ? '：' + reason : '。'}`,
                        recipientType: 'customer', customerId: e.customerId, link: customerLink,
                    });
                }
                else if (e.toState === 'ExchangeShipped') {
                    const req = await this.afterSalesRequestRow(e.requestId);
                    await this.deliver(ctx, {
                        scene: 'after_sales', title: '换货已发货',
                        content: `商家已寄出换货新品${(req === null || req === void 0 ? void 0 : req.exchangeTrackingNo) ? `（运单号 ${req.exchangeTrackingNo}）` : ''}，请确认收货。`,
                        recipientType: 'customer', customerId: e.customerId, link: customerLink,
                    });
                }
                else if (e.toState === 'Closed' && e.fromState === 'ExchangeShipped') {
                    await this.deliver(ctx, {
                        scene: 'after_sales', title: '换货完成',
                        content: '换货已完成，感谢您的耐心等待。',
                        recipientType: 'customer', customerId: e.customerId, link: customerLink,
                    });
                }
                else if (cTitles[e.toState]) {
                    await this.deliver(ctx, {
                        scene: 'after_sales', title: cTitles[e.toState], content: cContents[e.toState],
                        recipientType: 'customer', customerId: e.customerId, link: customerLink,
                    });
                }
            }
            // ---- 商家侧（商品归属店铺管理员）----
            if (e.toState === 'Pending' && e.fromState === null) {
                await this.notifyAfterSalesMerchant(ctx, e.requestId, '新售后待处理', `您有一笔新的售后申请（订单 ${(_b = e.orderCode) !== null && _b !== void 0 ? _b : e.orderId}），请及时处理。`);
            }
            else if (e.toState === 'Returning') {
                await this.notifyAfterSalesMerchant(ctx, e.requestId, '顾客已寄回', `顾客已填写退货物流（订单 ${(_c = e.orderCode) !== null && _c !== void 0 ? _c : e.orderId}），请尽快确认收货。`);
            }
        }
        catch (err) {
            core_1.Logger.warn(`onAfterSalesStateTransition failed: ${(_d = err === null || err === void 0 ? void 0 : err.message) !== null && _d !== void 0 ? _d : err}`, constants_1.loggerCtx);
        }
    }
    /** 商家（商品归属店铺 administratorId）售后站内信；无店铺归属（自营）则不落。 */
    async notifyAfterSalesMerchant(ctx, requestId, title, content) {
        var _a;
        try {
            const request = await this.connection.rawConnection.getRepository(after_sales_plugin_1.AfterSalesRequest).findOne({
                where: { id: requestId },
                relations: { order: { lines: { productVariant: true } } },
            });
            if (!(request === null || request === void 0 ? void 0 : request.order))
                return;
            const shopIds = await this.getOrderShopIds(ctx, request.order);
            if (shopIds.length === 0)
                return;
            const shops = await this.connection.getRepository(ctx, shop_plugin_1.Shop).find({ where: { id: (0, typeorm_1.In)(shopIds) } });
            for (const shop of shops) {
                if (shop.administratorId == null)
                    continue;
                await this.createInbox(ctx, {
                    scene: 'after_sales', title, content, recipientType: 'admin',
                    link: `/after-sale/detail?id=${requestId}`,
                }, { recipientType: 'admin', administratorId: shop.administratorId });
            }
        }
        catch (err) {
            core_1.Logger.warn(`notifyAfterSalesMerchant failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, constants_1.loggerCtx);
        }
    }
    async afterSalesRequestRow(id) {
        return this.connection.rawConnection.getRepository(after_sales_plugin_1.AfterSalesRequest).findOne({ where: { id: id } });
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.NOTIFICATION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.CustomerService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map