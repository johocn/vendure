"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateOrders = populateOrders;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
const loggerCtx = 'PopulateChina';
async function populateOrders(app) {
    const channelService = app.get(core_1.ChannelService);
    const customerService = app.get(core_1.CustomerService);
    const orderService = app.get(core_1.OrderService);
    const variantService = app.get(core_1.ProductVariantService);
    const shippingMethodService = app.get(core_1.ShippingMethodService);
    const paymentMethodService = app.get(core_1.PaymentMethodService);
    const fulfillmentService = app.get(core_1.FulfillmentService);
    const conn = app.get(core_1.TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel));
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel)
        throw new Error('shop-a channel not found');
    let successCount = 0;
    let failCount = 0;
    for (const orderSrc of sources_1.ORDERS) {
        const targetChannel = orderSrc.channel === 'default' ? defaultChannel : shopAChannel;
        try {
            await (0, shared_1.withCtx)(app, targetChannel, async (ctx) => {
                await createOneOrder(ctx, orderSrc, {
                    customerService,
                    orderService,
                    variantService,
                    shippingMethodService,
                    paymentMethodService,
                    fulfillmentService,
                    conn,
                });
            });
            successCount++;
        }
        catch (e) {
            common_1.Logger.warn(`订单创建失败 (${orderSrc.channel}/${orderSrc.customerEmail}/${orderSrc.state}): ${e.message}`, loggerCtx);
            failCount++;
        }
    }
    console.log(`  订单: ${successCount}/${sources_1.ORDERS.length} 成功, ${failCount} 失败`);
}
async function createOneOrder(ctx, orderSrc, deps) {
    var _a, _b, _c;
    const { customerService, orderService, variantService, shippingMethodService } = deps;
    // 1. 找到客户（需带 user 关系以拿到 userId）
    const customerResult = await customerService.findAll(ctx, {
        filter: { emailAddress: { eq: orderSrc.customerEmail } },
        take: 1,
    });
    const customer = customerResult.items[0];
    if (!customer)
        throw new Error(`Customer not found: ${orderSrc.customerEmail}`);
    const fullCustomer = await customerService.findOne(ctx, customer.id, ['user', 'addresses']);
    if (!fullCustomer)
        throw new Error(`Customer not found by id: ${customer.id}`);
    if (!((_a = fullCustomer.user) === null || _a === void 0 ? void 0 : _a.id))
        throw new Error(`Customer ${orderSrc.customerEmail} has no user`);
    // 2. 创建 draft order（关联 user）
    const order = await orderService.create(ctx, fullCustomer.user.id);
    // 3. 添加商品
    for (const item of orderSrc.items) {
        const variants = await variantService.findAll(ctx, {
            filter: { sku: { eq: item.sku } },
            take: 1,
        });
        const variant = variants.items[0];
        if (!variant)
            throw new Error(`Variant not found: ${item.sku}`);
        const added = await orderService.addItemToOrder(ctx, order.id, variant.id, item.quantity);
        if ((0, core_1.isGraphQlErrorResult)(added)) {
            throw new Error(`addItemToOrder failed for ${item.sku}: ${added.message}`);
        }
    }
    // 4. 设置配送地址（用客户默认地址）
    const defaultAddress = (_b = fullCustomer.addresses) === null || _b === void 0 ? void 0 : _b[0];
    if (defaultAddress) {
        await orderService.setShippingAddress(ctx, order.id, {
            fullName: `${fullCustomer.lastName}${fullCustomer.firstName}`,
            streetLine1: defaultAddress.streetLine1,
            city: defaultAddress.city,
            province: defaultAddress.province,
            postalCode: defaultAddress.postalCode,
            countryCode: 'CN',
        });
    }
    // 5. 设置配送方式
    const shippingMethods = await shippingMethodService.findAll(ctx);
    const shippingMethod = shippingMethods.items.find(sm => sm.code === orderSrc.shippingMethodCode);
    if (!shippingMethod)
        throw new Error(`Shipping method not found: ${orderSrc.shippingMethodCode}`);
    const setShippingResult = await orderService.setShippingMethod(ctx, order.id, [shippingMethod.id]);
    if ((0, core_1.isGraphQlErrorResult)(setShippingResult)) {
        throw new Error(`setShippingMethod failed: ${setShippingResult.message}`);
    }
    // 6. 应用优惠券
    if (orderSrc.couponCodes) {
        for (const code of orderSrc.couponCodes) {
            try {
                const applied = await orderService.applyCouponCode(ctx, order.id, code);
                if ((0, core_1.isGraphQlErrorResult)(applied)) {
                    common_1.Logger.warn(`优惠券应用失败 ${code}: ${applied.message}`, loggerCtx);
                }
            }
            catch (e) {
                common_1.Logger.warn(`优惠券应用异常 ${code}: ${e.message}`, loggerCtx);
            }
        }
    }
    // 7. Cancelled: 直接取消并返回
    if (orderSrc.state === 'Cancelled') {
        const cancelResult = await orderService.cancelOrder(ctx, {
            orderId: order.id,
            reason: '测试取消',
        });
        if ((0, core_1.isGraphQlErrorResult)(cancelResult)) {
            throw new Error(`cancelOrder failed: ${cancelResult.message}`);
        }
        return;
    }
    // 8. ArrangingPayment: 仅转换到 ArrangingPayment 即可（无支付）
    if (orderSrc.state === 'ArrangingPayment') {
        const transitionResult = await orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
        if ((0, core_1.isGraphQlErrorResult)(transitionResult)) {
            throw new Error(`transitionTo ArrangingPayment failed: ${transitionResult.message}`);
        }
        return;
    }
    // 9. PaymentSettled / Shipped / Completed: 需要先付款
    if (orderSrc.paymentMethodCode) {
        await transitionTo(ctx, orderService, order.id, 'ArrangingPayment');
        const paymentMethods = await deps.paymentMethodService.findAll(ctx);
        const paymentMethod = paymentMethods.items.find(pm => pm.code === orderSrc.paymentMethodCode);
        if (!paymentMethod)
            throw new Error(`Payment method not found: ${orderSrc.paymentMethodCode}`);
        // addPaymentToOrder 必须在事务中调用
        const paymentInput = {
            method: paymentMethod.code,
            metadata: {},
        };
        const paymentResult = await deps.conn.withTransaction(ctx, async (txCtx) => {
            return orderService.addPaymentToOrder(txCtx, order.id, paymentInput);
        });
        if ((0, core_1.isGraphQlErrorResult)(paymentResult)) {
            throw new Error(`addPaymentToOrder failed: ${paymentResult.message}`);
        }
    }
    else {
        throw new Error(`Order state ${orderSrc.state} requires paymentMethodCode`);
    }
    // 10. Shipped / Completed: 创建 fulfillment（自动转换到 Shipped）
    if (orderSrc.state === 'Shipped' || orderSrc.state === 'Completed') {
        const updatedOrder = await orderService.findOne(ctx, order.id);
        if (!((_c = updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.lines) === null || _c === void 0 ? void 0 : _c.length)) {
            throw new Error('Order has no lines for fulfillment');
        }
        try {
            const fulfillmentResult = await deps.fulfillmentService.create(ctx, [updatedOrder], updatedOrder.lines.map(l => ({
                orderLineId: l.id,
                quantity: l.quantity,
            })), { code: 'manual-fulfillment', arguments: [] });
            if ((0, core_1.isGraphQlErrorResult)(fulfillmentResult)) {
                common_1.Logger.warn(`Fulfillment 创建失败: ${fulfillmentResult.message}`, loggerCtx);
            }
        }
        catch (e) {
            common_1.Logger.warn(`Fulfillment 创建异常: ${e.message}`, loggerCtx);
        }
        // 11. Completed → 转换到 Delivered（Vendure 默认无 Completed 状态）
        if (orderSrc.state === 'Completed') {
            try {
                await transitionTo(ctx, orderService, order.id, 'Delivered');
            }
            catch (e) {
                common_1.Logger.warn(`订单 Delivered 转换失败: ${e.message}`, loggerCtx);
            }
        }
    }
}
async function transitionTo(ctx, orderService, orderId, state) {
    const result = await orderService.transitionToState(ctx, orderId, state);
    if ((0, core_1.isGraphQlErrorResult)(result)) {
        throw new Error(`transitionTo ${state} failed: ${result.message}`);
    }
}
//# sourceMappingURL=06-orders.js.map