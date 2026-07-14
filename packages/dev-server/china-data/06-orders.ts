import { INestApplication, Logger } from '@nestjs/common';
import { PaymentInput } from '@vendure/common/lib/generated-shop-types';
import {
    ChannelService,
    CustomerService,
    FulfillmentService,
    isGraphQlErrorResult,
    OrderService,
    PaymentMethodService,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    ShippingMethodService,
    TransactionalConnection,
} from '@vendure/core';

import { withCtx } from './shared';
import { ORDERS, OrderSource } from './sources';

const loggerCtx = 'PopulateChina';

export async function populateOrders(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const customerService = app.get(CustomerService);
    const orderService = app.get(OrderService);
    const variantService = app.get(ProductVariantService);
    const shippingMethodService = app.get(ShippingMethodService);
    const paymentMethodService = app.get(PaymentMethodService);
    const fulfillmentService = app.get(FulfillmentService);
    const conn = app.get(TransactionalConnection);

    const defaultChannel = await channelService.getDefaultChannel();
    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(
        await app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: defaultChannel }),
    );
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel) throw new Error('shop-a channel not found');

    let successCount = 0;
    let failCount = 0;

    for (const orderSrc of ORDERS) {
        const targetChannel = orderSrc.channel === 'default' ? defaultChannel : shopAChannel;
        try {
            await withCtx(app, targetChannel, async ctx => {
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
        } catch (e: any) {
            Logger.warn(
                `订单创建失败 (${orderSrc.channel}/${orderSrc.customerEmail}/${orderSrc.state}): ${e.message}`,
                loggerCtx,
            );
            failCount++;
        }
    }
    console.log(`  订单: ${successCount}/${ORDERS.length} 成功, ${failCount} 失败`);
}

interface OrderDeps {
    customerService: CustomerService;
    orderService: OrderService;
    variantService: ProductVariantService;
    shippingMethodService: ShippingMethodService;
    paymentMethodService: PaymentMethodService;
    fulfillmentService: FulfillmentService;
    conn: TransactionalConnection;
}

async function createOneOrder(
    ctx: RequestContext,
    orderSrc: OrderSource,
    deps: OrderDeps,
): Promise<void> {
    const { customerService, orderService, variantService, shippingMethodService } = deps;

    // 1. 找到客户（需带 user 关系以拿到 userId）
    const customerResult = await customerService.findAll(ctx, {
        filter: { emailAddress: { eq: orderSrc.customerEmail } },
        take: 1,
    });
    const customer = customerResult.items[0];
    if (!customer) throw new Error(`Customer not found: ${orderSrc.customerEmail}`);

    const fullCustomer = await customerService.findOne(ctx, customer.id, ['user', 'addresses']);
    if (!fullCustomer) throw new Error(`Customer not found by id: ${customer.id}`);
    if (!fullCustomer.user?.id) throw new Error(`Customer ${orderSrc.customerEmail} has no user`);

    // 2. 创建 draft order（关联 user）
    const order = await orderService.create(ctx, fullCustomer.user.id);

    // 3. 添加商品
    for (const item of orderSrc.items) {
        const variants = await variantService.findAll(ctx, {
            filter: { sku: { eq: item.sku } },
            take: 1,
        });
        const variant = variants.items[0];
        if (!variant) throw new Error(`Variant not found: ${item.sku}`);
        const added = await orderService.addItemToOrder(
            ctx,
            order.id,
            variant.id,
            item.quantity,
        );
        if (isGraphQlErrorResult(added)) {
            throw new Error(`addItemToOrder failed for ${item.sku}: ${added.message}`);
        }
    }

    // 4. 设置配送地址（用客户默认地址）
    const defaultAddress = fullCustomer.addresses?.[0];
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
    if (!shippingMethod) throw new Error(`Shipping method not found: ${orderSrc.shippingMethodCode}`);
    const setShippingResult = await orderService.setShippingMethod(ctx, order.id, [shippingMethod.id]);
    if (isGraphQlErrorResult(setShippingResult)) {
        throw new Error(`setShippingMethod failed: ${setShippingResult.message}`);
    }

    // 6. 应用优惠券
    if (orderSrc.couponCodes) {
        for (const code of orderSrc.couponCodes) {
            try {
                const applied = await orderService.applyCouponCode(ctx, order.id, code);
                if (isGraphQlErrorResult(applied)) {
                    Logger.warn(`优惠券应用失败 ${code}: ${applied.message}`, loggerCtx);
                }
            } catch (e: any) {
                Logger.warn(`优惠券应用异常 ${code}: ${e.message}`, loggerCtx);
            }
        }
    }

    // 7. Cancelled: 直接取消并返回
    if (orderSrc.state === 'Cancelled') {
        const cancelResult = await orderService.cancelOrder(ctx, {
            orderId: order.id,
            reason: '测试取消',
        });
        if (isGraphQlErrorResult(cancelResult)) {
            throw new Error(`cancelOrder failed: ${cancelResult.message}`);
        }
        return;
    }

    // 8. ArrangingPayment: 仅转换到 ArrangingPayment 即可（无支付）
    if (orderSrc.state === 'ArrangingPayment') {
        const transitionResult = await orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
        if (isGraphQlErrorResult(transitionResult)) {
            throw new Error(`transitionTo ArrangingPayment failed: ${transitionResult.message}`);
        }
        return;
    }

    // 9. PaymentSettled / Shipped / Completed: 需要先付款
    if (orderSrc.paymentMethodCode) {
        await transitionTo(ctx, orderService, order.id, 'ArrangingPayment');

        const paymentMethods = await deps.paymentMethodService.findAll(ctx);
        const paymentMethod = paymentMethods.items.find(pm => pm.code === orderSrc.paymentMethodCode);
        if (!paymentMethod) throw new Error(`Payment method not found: ${orderSrc.paymentMethodCode}`);

        // addPaymentToOrder 必须在事务中调用
        const paymentInput: PaymentInput = {
            method: paymentMethod.code,
            metadata: {},
        };
        const paymentResult = await deps.conn.withTransaction(ctx, async txCtx => {
            return orderService.addPaymentToOrder(txCtx, order.id, paymentInput);
        });
        if (isGraphQlErrorResult(paymentResult)) {
            throw new Error(`addPaymentToOrder failed: ${paymentResult.message}`);
        }
    } else {
        throw new Error(`Order state ${orderSrc.state} requires paymentMethodCode`);
    }

    // 10. Shipped / Completed: 创建 fulfillment（自动转换到 Shipped）
    if (orderSrc.state === 'Shipped' || orderSrc.state === 'Completed') {
        const updatedOrder = await orderService.findOne(ctx, order.id);
        if (!updatedOrder?.lines?.length) {
            throw new Error('Order has no lines for fulfillment');
        }
        try {
            const fulfillmentResult = await deps.fulfillmentService.create(
                ctx,
                [updatedOrder],
                updatedOrder.lines.map(l => ({
                    orderLineId: l.id as string,
                    quantity: l.quantity,
                })),
                { code: 'manual-fulfillment', arguments: [] },
            );
            if (isGraphQlErrorResult(fulfillmentResult)) {
                Logger.warn(`Fulfillment 创建失败: ${fulfillmentResult.message}`, loggerCtx);
            }
        } catch (e: any) {
            Logger.warn(`Fulfillment 创建异常: ${e.message}`, loggerCtx);
        }

        // 11. Completed → 转换到 Delivered（Vendure 默认无 Completed 状态）
        if (orderSrc.state === 'Completed') {
            try {
                await transitionTo(ctx, orderService, order.id, 'Delivered');
            } catch (e: any) {
                Logger.warn(`订单 Delivered 转换失败: ${e.message}`, loggerCtx);
            }
        }
    }
}

async function transitionTo(
    ctx: RequestContext,
    orderService: OrderService,
    orderId: string | number,
    state: 'ArrangingPayment' | 'Delivered',
): Promise<void> {
    const result = await orderService.transitionToState(ctx, orderId as any, state as any);
    if (isGraphQlErrorResult(result)) {
        throw new Error(`transitionTo ${state} failed: ${result.message}`);
    }
}
