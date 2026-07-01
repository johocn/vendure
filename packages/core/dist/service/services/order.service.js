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
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const omit_1 = require("@vendure/common/lib/omit");
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const typeorm_1 = require("typeorm");
const FindOptionsUtils_1 = require("typeorm/find-options/FindOptionsUtils");
const request_context_cache_service_1 = require("../../cache/request-context-cache.service");
const constants_1 = require("../../common/constants");
const error_result_1 = require("../../common/error/error-result");
const errors_1 = require("../../common/error/errors");
const generated_graphql_admin_errors_1 = require("../../common/error/generated-graphql-admin-errors");
const generated_graphql_shop_errors_1 = require("../../common/error/generated-graphql-shop-errors");
const instrument_decorator_1 = require("../../common/instrument-decorator");
const tax_utils_1 = require("../../common/tax-utils");
const utils_1 = require("../../common/utils");
const config_service_1 = require("../../config/config.service");
const vendure_logger_1 = require("../../config/logger/vendure-logger");
const transactional_connection_1 = require("../../connection/transactional-connection");
const fulfillment_line_entity_1 = require("../../entity/order-line-reference/fulfillment-line.entity");
const order_line_entity_1 = require("../../entity/order-line/order-line.entity");
const order_modification_entity_1 = require("../../entity/order-modification/order-modification.entity");
const order_entity_1 = require("../../entity/order/order.entity");
const payment_entity_1 = require("../../entity/payment/payment.entity");
const product_variant_entity_1 = require("../../entity/product-variant/product-variant.entity");
const promotion_entity_1 = require("../../entity/promotion/promotion.entity");
const refund_entity_1 = require("../../entity/refund/refund.entity");
const session_entity_1 = require("../../entity/session/session.entity");
const shipping_line_entity_1 = require("../../entity/shipping-line/shipping-line.entity");
const surcharge_entity_1 = require("../../entity/surcharge/surcharge.entity");
const event_bus_1 = require("../../event-bus/event-bus");
const coupon_code_event_1 = require("../../event-bus/events/coupon-code-event");
const order_event_1 = require("../../event-bus/events/order-event");
const order_line_event_1 = require("../../event-bus/events/order-line-event");
const order_state_transition_event_1 = require("../../event-bus/events/order-state-transition-event");
const refund_event_1 = require("../../event-bus/events/refund-event");
const refund_state_transition_event_1 = require("../../event-bus/events/refund-state-transition-event");
const custom_field_relation_service_1 = require("../helpers/custom-field-relation/custom-field-relation.service");
const list_query_builder_1 = require("../helpers/list-query-builder/list-query-builder");
const order_calculator_1 = require("../helpers/order-calculator/order-calculator");
const order_merger_1 = require("../helpers/order-merger/order-merger");
const order_modifier_1 = require("../helpers/order-modifier/order-modifier");
const order_state_machine_1 = require("../helpers/order-state-machine/order-state-machine");
const refund_state_machine_1 = require("../helpers/refund-state-machine/refund-state-machine");
const shipping_calculator_1 = require("../helpers/shipping-calculator/shipping-calculator");
const translator_service_1 = require("../helpers/translator/translator.service");
const db_errors_1 = require("../helpers/utils/db-errors");
const order_utils_1 = require("../helpers/utils/order-utils");
const patch_entity_1 = require("../helpers/utils/patch-entity");
const channel_service_1 = require("./channel.service");
const country_service_1 = require("./country.service");
const customer_service_1 = require("./customer.service");
const fulfillment_service_1 = require("./fulfillment.service");
const history_service_1 = require("./history.service");
const payment_method_service_1 = require("./payment-method.service");
const payment_service_1 = require("./payment.service");
const product_variant_service_1 = require("./product-variant.service");
const promotion_service_1 = require("./promotion.service");
const stock_level_service_1 = require("./stock-level.service");
/**
 * @description
 * Contains methods relating to {@link Order} entities.
 *
 * @docsCategory services
 */
let OrderService = class OrderService {
    constructor(connection, configService, productVariantService, customerService, countryService, orderCalculator, shippingCalculator, orderStateMachine, orderMerger, paymentService, paymentMethodService, fulfillmentService, listQueryBuilder, refundStateMachine, historyService, promotionService, eventBus, channelService, orderModifier, customFieldRelationService, requestCache, translator, stockLevelService) {
        this.connection = connection;
        this.configService = configService;
        this.productVariantService = productVariantService;
        this.customerService = customerService;
        this.countryService = countryService;
        this.orderCalculator = orderCalculator;
        this.shippingCalculator = shippingCalculator;
        this.orderStateMachine = orderStateMachine;
        this.orderMerger = orderMerger;
        this.paymentService = paymentService;
        this.paymentMethodService = paymentMethodService;
        this.fulfillmentService = fulfillmentService;
        this.listQueryBuilder = listQueryBuilder;
        this.refundStateMachine = refundStateMachine;
        this.historyService = historyService;
        this.promotionService = promotionService;
        this.eventBus = eventBus;
        this.channelService = channelService;
        this.orderModifier = orderModifier;
        this.customFieldRelationService = customFieldRelationService;
        this.requestCache = requestCache;
        this.translator = translator;
        this.stockLevelService = stockLevelService;
    }
    /**
     * @description
     * Returns an array of all the configured states and transitions of the order process. This is
     * based on the default order process plus all configured {@link OrderProcess} objects
     * defined in the {@link OrderOptions} `process` array.
     */
    getOrderProcessStates() {
        return Object.entries(this.orderStateMachine.config.transitions).map(([name, { to }]) => ({
            name,
            to,
        }));
    }
    findAll(ctx, options, relations) {
        return this.listQueryBuilder
            .build(order_entity_1.Order, options, {
            ctx,
            relations: relations !== null && relations !== void 0 ? relations : [
                'lines',
                'customer',
                'lines.productVariant',
                'channels',
                'shippingLines',
                'payments',
            ],
            channelId: ctx.channelId,
            customPropertyMap: {
                customerLastName: 'customer.lastName',
                transactionId: 'payments.transactionId',
            },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            };
        });
    }
    async findOne(ctx, orderId, relations) {
        const qb = this.connection.getRepository(ctx, order_entity_1.Order).createQueryBuilder('order');
        const effectiveRelations = relations !== null && relations !== void 0 ? relations : [
            'channels',
            'customer',
            'customer.user',
            'lines',
            'lines.productVariant',
            'lines.productVariant.taxCategory',
            'lines.productVariant.productVariantPrices',
            'lines.productVariant.translations',
            'lines.featuredAsset',
            'lines.taxCategory',
            'shippingLines',
            'surcharges',
        ];
        // Any caller requesting `lines.productVariant` (directly or via a sub-relation
        // path) implies the variant will be loaded into the split lines query and
        // translated below. TypeORM doesn't honour transitive `eager: true` relations
        // (like `ProductVariant.translations`) when an explicit `relations` array is
        // passed to `setFindOptions`, so we inject `taxCategory` and `translations`
        // ourselves to keep `applyChannelPriceAndTax` + `translator.translate` correct.
        const wantsLineVariant = effectiveRelations.some(r => r === 'lines.productVariant' || r.startsWith('lines.productVariant.'));
        if (relations && wantsLineVariant) {
            if (!effectiveRelations.includes('lines.productVariant.taxCategory')) {
                effectiveRelations.push('lines.productVariant.taxCategory');
            }
            if (!effectiveRelations.includes('lines.productVariant.translations')) {
                effectiveRelations.push('lines.productVariant.translations');
            }
        }
        // Split relations into two groups for different loading strategies:
        // Main order relations - loaded with 'query' strategy for performance
        const orderRelations = effectiveRelations.filter(r => !r.startsWith('lines'));
        // Lines relations - loaded with 'join' strategy to enable multi-column sorting
        const lineRelations = effectiveRelations
            .filter(r => r.startsWith('lines.'))
            .map(r => r.replace('lines.', ''));
        qb.setFindOptions({
            relations: orderRelations,
            relationLoadStrategy: 'query',
        })
            .leftJoin('order.channels', 'channel')
            .where('order.id = :orderId', { orderId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        FindOptionsUtils_1.FindOptionsUtils.joinEagerRelations(qb, qb.alias, qb.expressionMap.mainAlias.metadata);
        const order = await qb.getOne();
        if (order) {
            const hasLinesRelations = effectiveRelations.some(r => r.startsWith('lines'));
            if (hasLinesRelations) {
                const linesQb = this.connection.getRepository(ctx, order_line_entity_1.OrderLine).createQueryBuilder('line');
                linesQb
                    .setFindOptions({
                    relations: lineRelations,
                })
                    .where('line.orderId = :orderId', { orderId })
                    .addOrderBy('line.createdAt', 'ASC')
                    .addOrderBy('line.productVariantId', 'ASC');
                const lines = await linesQb.getMany();
                order.lines = lines;
            }
            if (wantsLineVariant) {
                for (const line of order.lines) {
                    line.productVariant = this.translator.translate(await this.productVariantService.applyChannelPriceAndTax(line.productVariant, ctx, order), ctx);
                }
            }
            return order;
        }
    }
    async findOneByCode(ctx, orderCode, relations) {
        const order = await this.connection.getRepository(ctx, order_entity_1.Order).findOne({
            relations: ['customer'],
            where: {
                code: orderCode,
            },
        });
        return order ? this.findOne(ctx, order.id, relations) : undefined;
    }
    async findOneByOrderLineId(ctx, orderLineId, relations) {
        const order = await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .innerJoin('order.lines', 'line', 'line.id = :orderLineId', { orderLineId })
            .getOne();
        return order ? this.findOne(ctx, order.id, relations) : undefined;
    }
    async findByCustomerId(ctx, customerId, options, relations) {
        return this.listQueryBuilder
            .build(order_entity_1.Order, options, {
            relations: relations !== null && relations !== void 0 ? relations : ['lines', 'customer', 'channels', 'shippingLines'],
            channelId: ctx.channelId,
            ctx,
        })
            .andWhere('order.state != :draftState', { draftState: 'Draft' })
            .andWhere('order.customer.id = :customerId', { customerId })
            .getManyAndCount()
            .then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            };
        });
    }
    /**
     * @description
     * Returns all {@link Payment} entities associated with the Order.
     */
    getOrderPayments(ctx, orderId) {
        return this.connection.getRepository(ctx, payment_entity_1.Payment).find({
            relations: ['refunds'],
            where: {
                order: { id: orderId },
            },
        });
    }
    /**
     * @description
     * Returns an array of any {@link OrderModification} entities associated with the Order.
     */
    getOrderModifications(ctx, orderId) {
        return this.connection.getRepository(ctx, order_modification_entity_1.OrderModification).find({
            where: {
                order: { id: orderId },
            },
            relations: ['lines', 'payment', 'refund', 'surcharges'],
        });
    }
    /**
     * @description
     * Returns any {@link Refund}s associated with a {@link Payment}.
     */
    getPaymentRefunds(ctx, paymentId) {
        return this.connection.getRepository(ctx, refund_entity_1.Refund).find({
            where: {
                paymentId,
            },
        });
    }
    getSellerOrders(ctx, order) {
        return this.connection.getRepository(ctx, order_entity_1.Order).find({
            where: {
                aggregateOrderId: order.id,
            },
            relations: ['channels'],
        });
    }
    async getAggregateOrder(ctx, order) {
        return order.aggregateOrderId == null
            ? undefined
            : this.connection
                .getRepository(ctx, order_entity_1.Order)
                .findOne({ where: { id: order.aggregateOrderId }, relations: ['channels', 'lines'] })
                .then(result => result !== null && result !== void 0 ? result : undefined);
    }
    getOrderChannels(ctx, order) {
        return this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .relation('channels')
            .of(order)
            .loadMany();
    }
    /**
     * @description
     * Returns any Order associated with the specified User's Customer account
     * that is still in the `active` state.
     */
    async getActiveOrderForUser(ctx, userId) {
        const customer = await this.customerService.findOneByUserId(ctx, userId);
        if (customer) {
            const activeOrder = await this.connection
                .getRepository(ctx, order_entity_1.Order)
                .createQueryBuilder('order')
                .innerJoinAndSelect('order.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
                .leftJoinAndSelect('order.customer', 'customer')
                .leftJoinAndSelect('order.shippingLines', 'shippingLines')
                .where('order.active = :active', { active: true })
                .andWhere('order.customer.id = :customerId', { customerId: customer.id })
                .orderBy('order.createdAt', 'DESC')
                .getOne();
            if (activeOrder) {
                return this.findOne(ctx, activeOrder.id);
            }
        }
    }
    /**
     * @description
     * Creates a new, empty Order. If a `userId` is passed, the Order will get associated with that
     * User's Customer account.
     */
    async create(ctx, userId) {
        const newOrder = await this.createEmptyOrderEntity(ctx);
        if (userId) {
            const customer = await this.customerService.findOneByUserId(ctx, userId);
            if (customer) {
                newOrder.customer = customer;
            }
        }
        await this.channelService.assignToCurrentChannel(newOrder, ctx);
        const order = await this.connection.getRepository(ctx, order_entity_1.Order).save(newOrder);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, order, 'created'));
        const transitionResult = await this.transitionToState(ctx, order.id, 'AddingItems');
        if ((0, error_result_1.isGraphQlErrorResult)(transitionResult)) {
            // this should never occur, so we will throw rather than return
            throw transitionResult;
        }
        return transitionResult;
    }
    async createDraft(ctx) {
        const newOrder = await this.createEmptyOrderEntity(ctx);
        newOrder.active = false;
        await this.channelService.assignToCurrentChannel(newOrder, ctx);
        const order = await this.connection.getRepository(ctx, order_entity_1.Order).save(newOrder);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, order, 'created'));
        const transitionResult = await this.transitionToState(ctx, order.id, 'Draft');
        if ((0, error_result_1.isGraphQlErrorResult)(transitionResult)) {
            // this should never occur, so we will throw rather than return
            throw transitionResult;
        }
        return transitionResult;
    }
    async createEmptyOrderEntity(ctx) {
        return new order_entity_1.Order({
            type: generated_types_1.OrderType.Regular,
            code: await this.configService.orderOptions.orderCodeStrategy.generate(ctx),
            state: this.orderStateMachine.getInitialState(),
            lines: [],
            surcharges: [],
            couponCodes: [],
            modifications: [],
            shippingAddress: {},
            billingAddress: {},
            subTotal: 0,
            subTotalWithTax: 0,
            currencyCode: ctx.currencyCode,
        });
    }
    /**
     * @description
     * Updates the custom fields of an Order.
     */
    async updateCustomFields(ctx, orderId, customFields) {
        let order = await this.getOrderOrThrow(ctx, orderId);
        order = (0, patch_entity_1.patchEntity)(order, { customFields });
        const updatedOrder = await this.connection.getRepository(ctx, order_entity_1.Order).save(order);
        await this.customFieldRelationService.updateRelations(ctx, order_entity_1.Order, { customFields }, updatedOrder);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, updatedOrder, 'updated', { customFields }));
        return updatedOrder;
    }
    /**
     * @description
     * Updates the Customer which is assigned to a given Order. The target Customer must be assigned to the same
     * Channels as the Order, otherwise an error will be thrown.
     *
     * @since 2.2.0
     */
    async updateOrderCustomer(ctx, { customerId, orderId, note }) {
        const order = await this.getOrderOrThrow(ctx, orderId, ['channels', 'customer']);
        const currentCustomer = order.customer;
        if ((currentCustomer === null || currentCustomer === void 0 ? void 0 : currentCustomer.id) === customerId) {
            // No change in customer, so just return the order as-is
            return order;
        }
        const targetCustomer = await this.customerService.findOne(ctx, customerId, ['channels']);
        if (!targetCustomer) {
            throw new errors_1.EntityNotFoundError('Customer', customerId);
        }
        // ensure the customer is assigned to the same channels as the order
        const channelIds = order.channels.map(c => c.id);
        const customerChannelIds = targetCustomer.channels.map(c => c.id);
        const missingChannelIds = channelIds.filter(id => !customerChannelIds.includes(id));
        if (missingChannelIds.length) {
            throw new errors_1.UserInputError(`error.target-customer-not-assigned-to-order-channels`, {
                channelIds: missingChannelIds.join(', '),
            });
        }
        const updatedOrder = await this.addCustomerToOrder(ctx, order.id, targetCustomer);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, updatedOrder, 'updated', targetCustomer));
        await this.historyService.createHistoryEntryForOrder({
            ctx,
            orderId,
            type: generated_types_1.HistoryEntryType.ORDER_CUSTOMER_UPDATED,
            data: {
                previousCustomerId: currentCustomer === null || currentCustomer === void 0 ? void 0 : currentCustomer.id,
                previousCustomerName: currentCustomer && `${currentCustomer.firstName} ${currentCustomer.lastName}`,
                newCustomerId: targetCustomer.id,
                newCustomerName: `${targetCustomer.firstName} ${targetCustomer.lastName}`,
                note,
            },
        });
        return updatedOrder;
    }
    /**
     * @description
     * Updates the currency code of an Order. This will recalculate all prices
     * in the new currency using `applyPriceAdjustments`.
     *
     * @since 3.3.0
     */
    async updateOrderCurrency(ctx, orderId, currencyCode, relations) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const validationError = this.assertAddingItemsState(order);
        if (validationError) {
            return validationError;
        }
        if (order.currencyCode === currencyCode) {
            return order;
        }
        const channel = await this.channelService.getChannelFromToken(ctx.channel.token);
        if (!channel.availableCurrencyCodes.includes(currencyCode)) {
            throw new errors_1.UserInputError('error.currency-not-available', { currencyCode });
        }
        const previousCurrencyCode = order.currencyCode;
        const newCurrencyCtx = ctx.copy();
        newCurrencyCtx._currencyCode = currencyCode;
        order.currencyCode = currencyCode;
        await this.historyService.createHistoryEntryForOrder({
            ctx,
            orderId: order.id,
            type: generated_types_1.HistoryEntryType.ORDER_CURRENCY_UPDATED,
            data: {
                previousCurrency: previousCurrencyCode,
                newCurrency: currencyCode,
            },
        });
        const updatedOrder = await this.applyPriceAdjustments(newCurrencyCtx, order, order.lines, relations);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, updatedOrder, 'updated'));
        return updatedOrder;
    }
    /**
     * @description
     * Adds an item to the Order, either creating a new OrderLine or
     * incrementing an existing one.
     *
     * If you need to add multiple items to an Order, use `addItemsToOrder()` instead.
     */
    async addItemToOrder(ctx, orderId, productVariantId, quantity, customFields, relations) {
        const result = await this.addItemsToOrder(ctx, orderId, [{ productVariantId, quantity, customFields }], relations);
        if (result.errorResults.length) {
            return result.errorResults[0];
        }
        else {
            return result.order;
        }
    }
    /**
     * @description
     * Adds multiple items to an Order. This method is more efficient than calling `addItemToOrder`
     * multiple times, as it only needs to fetch the entire Order once, and only performs
     * price adjustments once at the end.
     *
     * Since this method can return multiple error results, it is recommended to check the `errorResults`
     * array to determine if any errors occurred.
     *
     * @since 3.1.0
     */
    async addItemsToOrder(ctx, orderId, items, relations) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const errorResults = [];
        const updatedOrderLines = [];
        addItem: for (const item of items) {
            const { productVariantId, quantity, customFields } = item;
            const existingOrderLine = await this.orderModifier.getExistingOrderLine(ctx, order, productVariantId, customFields);
            const validationError = this.assertQuantityIsPositive(quantity) ||
                this.assertAddingItemsState(order) ||
                this.assertNotOverOrderItemsLimit(order, quantity) ||
                this.assertNotOverOrderLineItemsLimit(existingOrderLine, quantity);
            if (validationError) {
                errorResults.push(validationError);
                continue;
            }
            const variant = await this.connection.getEntityOrThrow(ctx, product_variant_entity_1.ProductVariant, productVariantId, {
                relations: ['product'],
                where: {
                    enabled: true,
                    deletedAt: (0, typeorm_1.IsNull)(),
                },
                loadEagerRelations: false,
            });
            if (variant.product.enabled === false) {
                throw new errors_1.EntityNotFoundError('ProductVariant', productVariantId);
            }
            const existingQuantityInOtherLines = (0, shared_utils_1.summate)(order.lines.filter(l => (0, utils_1.idsAreEqual)(l.productVariantId, productVariantId) &&
                !(0, utils_1.idsAreEqual)(l.id, existingOrderLine === null || existingOrderLine === void 0 ? void 0 : existingOrderLine.id)), 'quantity');
            const correctedQuantity = await this.orderModifier.constrainQuantityToSaleable(ctx, variant, quantity, existingOrderLine === null || existingOrderLine === void 0 ? void 0 : existingOrderLine.quantity, existingQuantityInOtherLines);
            if (correctedQuantity === 0) {
                errorResults.push(new generated_graphql_shop_errors_1.InsufficientStockError({ order, quantityAvailable: correctedQuantity }));
                continue;
            }
            const { orderInterceptors } = this.configService.orderOptions;
            for (const interceptor of orderInterceptors) {
                if (interceptor.willAddItemToOrder) {
                    const error = await interceptor.willAddItemToOrder(ctx, order, {
                        productVariant: variant,
                        quantity: correctedQuantity,
                        customFields,
                    });
                    if (error) {
                        errorResults.push(new generated_graphql_shop_errors_1.OrderInterceptorError({ interceptorError: error }));
                        continue addItem;
                    }
                }
            }
            const orderLine = await this.orderModifier.getOrCreateOrderLine(ctx, order, productVariantId, customFields);
            if (correctedQuantity < quantity) {
                const newQuantity = (existingOrderLine ? existingOrderLine === null || existingOrderLine === void 0 ? void 0 : existingOrderLine.quantity : 0) + correctedQuantity;
                await this.orderModifier.updateOrderLineQuantity(ctx, orderLine, newQuantity, order);
            }
            else {
                await this.orderModifier.updateOrderLineQuantity(ctx, orderLine, correctedQuantity, order);
            }
            updatedOrderLines.push(orderLine);
            const quantityWasAdjustedDown = correctedQuantity < quantity;
            if (quantityWasAdjustedDown) {
                errorResults.push(new generated_graphql_shop_errors_1.InsufficientStockError({ quantityAvailable: correctedQuantity, order }));
                continue;
            }
        }
        const updatedOrder = await this.applyPriceAdjustments(ctx, order, updatedOrderLines, relations);
        // for any InsufficientStockError errors, we want to make sure we use the final updatedOrder
        // after having applied all price adjustments
        for (const [i, errorResult] of Object.entries(errorResults)) {
            if (errorResult.__typename === 'InsufficientStockError') {
                errorResults[+i] = new generated_graphql_shop_errors_1.InsufficientStockError({
                    quantityAvailable: errorResult.quantityAvailable,
                    order: updatedOrder,
                });
            }
        }
        return {
            order: updatedOrder,
            errorResults,
        };
    }
    /**
     * @description
     * Adjusts the quantity and/or custom field values of an existing OrderLine.
     *
     * If you need to adjust multiple OrderLines, use `adjustOrderLines()` instead.
     */
    async adjustOrderLine(ctx, orderId, orderLineId, quantity, customFields, relations) {
        const result = await this.adjustOrderLines(ctx, orderId, [{ orderLineId, quantity, customFields }], relations);
        if (result.errorResults.length) {
            return result.errorResults[0];
        }
        else {
            return result.order;
        }
    }
    /**
     * @description
     * Adjusts the quantity and/or custom field values of existing OrderLines.
     * This method is more efficient than calling `adjustOrderLine` multiple times, as it only needs to fetch
     * the entire Order once, and only performs price adjustments once at the end.
     * Since this method can return multiple error results, it is recommended to check the `errorResults`
     * array to determine if any errors occurred.
     *
     * @since 3.1.0
     */
    async adjustOrderLines(ctx, orderId, lines, relations) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const errorResults = [];
        const updatedOrderLines = [];
        adjustLine: for (const line of lines) {
            const { orderLineId, quantity, customFields } = line;
            const orderLine = this.getOrderLineOrThrow(order, orderLineId);
            const validationError = this.assertAddingItemsState(order) ||
                this.assertQuantityIsPositive(quantity) ||
                this.assertNotOverOrderItemsLimit(order, quantity - orderLine.quantity) ||
                this.assertNotOverOrderLineItemsLimit(orderLine, quantity - orderLine.quantity);
            if (validationError) {
                errorResults.push(validationError);
                continue;
            }
            const { orderInterceptors } = this.configService.orderOptions;
            for (const interceptor of orderInterceptors) {
                if (interceptor.willAdjustOrderLine) {
                    const error = await interceptor.willAdjustOrderLine(ctx, order, {
                        orderLine,
                        quantity,
                        customFields,
                    });
                    if (error) {
                        errorResults.push(new generated_graphql_shop_errors_1.OrderInterceptorError({ interceptorError: error }));
                        continue adjustLine;
                    }
                }
            }
            if (customFields != null) {
                // Merge custom fields instead of replacing them entirely
                // This preserves existing values while allowing updates and null-based unsetting
                const existingCustomFields = orderLine.customFields || {};
                const mergedCustomFields = Object.assign({}, existingCustomFields);
                for (const [key, value] of Object.entries(customFields)) {
                    if (value !== undefined) {
                        // Update with the new value (including explicit null to unset)
                        mergedCustomFields[key] = value;
                    }
                    // If value is undefined, preserve the existing value (don't set it)
                }
                orderLine.customFields = mergedCustomFields;
                await this.customFieldRelationService.updateRelations(ctx, order_line_entity_1.OrderLine, { customFields: mergedCustomFields }, orderLine);
            }
            const existingQuantityInOtherLines = (0, shared_utils_1.summate)(order.lines.filter(l => (0, utils_1.idsAreEqual)(l.productVariantId, orderLine.productVariantId) &&
                !(0, utils_1.idsAreEqual)(l.id, orderLineId)), 'quantity');
            const correctedQuantity = await this.orderModifier.constrainQuantityToSaleable(ctx, orderLine.productVariant, quantity, 0, existingQuantityInOtherLines);
            if (correctedQuantity === 0) {
                order.lines = order.lines.filter(l => !(0, utils_1.idsAreEqual)(l.id, orderLine.id));
                const deletedOrderLine = new order_line_entity_1.OrderLine(orderLine);
                await this.connection.getRepository(ctx, order_line_entity_1.OrderLine).remove(orderLine);
                await this.eventBus.publish(new order_line_event_1.OrderLineEvent(ctx, order, deletedOrderLine, 'deleted'));
            }
            else {
                await this.orderModifier.updateOrderLineQuantity(ctx, orderLine, correctedQuantity, order);
                updatedOrderLines.push(orderLine);
            }
            const quantityWasAdjustedDown = correctedQuantity < quantity;
            if (quantityWasAdjustedDown) {
                errorResults.push(new generated_graphql_shop_errors_1.InsufficientStockError({
                    quantityAvailable: correctedQuantity,
                    order,
                }));
            }
        }
        const updatedOrder = await this.applyPriceAdjustments(ctx, order, updatedOrderLines, relations);
        for (const [i, errorResult] of Object.entries(errorResults)) {
            if (errorResult.__typename === 'InsufficientStockError') {
                errorResults[+i] = new generated_graphql_shop_errors_1.InsufficientStockError({
                    quantityAvailable: errorResult.quantityAvailable,
                    order: updatedOrder,
                });
            }
        }
        return {
            order: updatedOrder,
            errorResults,
        };
    }
    /**
     * @description
     * Removes the specified OrderLine from the Order.
     *
     * If you need to remove multiple OrderLines, use `removeItemsFromOrder()` instead.
     */
    async removeItemFromOrder(ctx, orderId, orderLineId) {
        return this.removeItemsFromOrder(ctx, orderId, [orderLineId]);
    }
    /**
     * @description
     * Removes the specified OrderLines from the Order.
     * This method is more efficient than calling `removeItemFromOrder` multiple times, as it only needs to fetch
     * the entire Order once, and only performs price adjustments once at the end.
     *
     * @since 3.1.0
     */
    async removeItemsFromOrder(ctx, orderId, orderLineIds) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const validationError = this.assertAddingItemsState(order);
        if (validationError) {
            return validationError;
        }
        const orderLinesToDelete = [];
        for (const orderLineId of orderLineIds) {
            const orderLine = this.getOrderLineOrThrow(order, orderLineId);
            const { orderInterceptors } = this.configService.orderOptions;
            for (const interceptor of orderInterceptors) {
                if (interceptor.willRemoveItemFromOrder) {
                    const error = await interceptor.willRemoveItemFromOrder(ctx, order, orderLine);
                    if (error) {
                        return new generated_graphql_shop_errors_1.OrderInterceptorError({ interceptorError: error });
                    }
                }
            }
            orderLinesToDelete.push(orderLine);
        }
        order.lines = order.lines.filter(line => !orderLineIds.find(olId => (0, utils_1.idsAreEqual)(line.id, olId)));
        // Persist the orderLine removal before applying price adjustments
        // so that any hydration of the Order entity during the course of the
        // `applyPriceAdjustments()` (e.g. in a ShippingEligibilityChecker etc)
        // will not re-add the OrderLine.
        await this.connection.getRepository(ctx, order_entity_1.Order).save(order, { reload: false });
        const updatedOrder = await this.applyPriceAdjustments(ctx, order);
        for (const orderLine of orderLinesToDelete) {
            const deletedOrderLine = new order_line_entity_1.OrderLine(orderLine);
            await this.connection.getRepository(ctx, order_line_entity_1.OrderLine).remove(orderLine);
            await this.eventBus.publish(new order_line_event_1.OrderLineEvent(ctx, order, deletedOrderLine, 'deleted'));
        }
        return updatedOrder;
    }
    /**
     * @description
     * Removes all OrderLines from the Order.
     */
    async removeAllItemsFromOrder(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const validationError = this.assertAddingItemsState(order);
        if (validationError) {
            return validationError;
        }
        const { orderInterceptors } = this.configService.orderOptions;
        for (const orderLine of order.lines) {
            for (const interceptor of orderInterceptors) {
                if (interceptor.willRemoveItemFromOrder) {
                    const error = await interceptor.willRemoveItemFromOrder(ctx, order, orderLine);
                    if (error) {
                        return new generated_graphql_shop_errors_1.OrderInterceptorError({ interceptorError: error });
                    }
                }
            }
        }
        await this.connection.getRepository(ctx, order_line_entity_1.OrderLine).remove(order.lines);
        order.lines = [];
        const updatedOrder = await this.applyPriceAdjustments(ctx, order);
        return updatedOrder;
    }
    /**
     * @description
     * Adds a {@link Surcharge} to the Order.
     */
    async addSurchargeToOrder(ctx, orderId, surchargeInput) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const surcharge = await this.connection.getRepository(ctx, surcharge_entity_1.Surcharge).save(new surcharge_entity_1.Surcharge(Object.assign({ taxLines: [], sku: '', listPriceIncludesTax: ctx.channel.pricesIncludeTax, order }, surchargeInput)));
        order.surcharges.push(surcharge);
        const updatedOrder = await this.applyPriceAdjustments(ctx, order);
        return updatedOrder;
    }
    /**
     * @description
     * Removes a {@link Surcharge} from the Order.
     */
    async removeSurchargeFromOrder(ctx, orderId, surchargeId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const surcharge = await this.connection.getEntityOrThrow(ctx, surcharge_entity_1.Surcharge, surchargeId);
        if (order.surcharges.find(s => (0, utils_1.idsAreEqual)(s.id, surcharge.id))) {
            order.surcharges = order.surcharges.filter(s => !(0, utils_1.idsAreEqual)(s.id, surchargeId));
            const updatedOrder = await this.applyPriceAdjustments(ctx, order);
            await this.connection.getRepository(ctx, surcharge_entity_1.Surcharge).remove(surcharge);
            return updatedOrder;
        }
        else {
            return order;
        }
    }
    /**
     * @description
     * Applies a coupon code to the Order, which should be a valid coupon code as specified in the configuration
     * of an active {@link Promotion}.
     */
    async applyCouponCode(ctx, orderId, couponCode) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        if (order.couponCodes.includes(couponCode)) {
            return order;
        }
        const validationResult = await this.promotionService.validateCouponCode(ctx, couponCode, order.customer && order.customer.id);
        if ((0, error_result_1.isGraphQlErrorResult)(validationResult)) {
            return validationResult;
        }
        order.couponCodes.push(couponCode);
        await this.historyService.createHistoryEntryForOrder({
            ctx,
            orderId: order.id,
            type: generated_types_1.HistoryEntryType.ORDER_COUPON_APPLIED,
            data: { couponCode, promotionId: validationResult.id },
        });
        await this.eventBus.publish(new coupon_code_event_1.CouponCodeEvent(ctx, couponCode, orderId, 'assigned'));
        return this.applyPriceAdjustments(ctx, order);
    }
    /**
     * @description
     * Removes a coupon code from the Order.
     */
    async removeCouponCode(ctx, orderId, couponCode) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        if (order.couponCodes.includes(couponCode)) {
            order.couponCodes = order.couponCodes.filter(cc => cc !== couponCode);
            await this.historyService.createHistoryEntryForOrder({
                ctx,
                orderId: order.id,
                type: generated_types_1.HistoryEntryType.ORDER_COUPON_REMOVED,
                data: { couponCode },
            });
            await this.eventBus.publish(new coupon_code_event_1.CouponCodeEvent(ctx, couponCode, orderId, 'removed'));
            return this.applyPriceAdjustments(ctx, order);
        }
        else {
            return order;
        }
    }
    /**
     * @description
     * Returns all {@link Promotion}s associated with an Order.
     */
    async getOrderPromotions(ctx, orderId) {
        const order = await this.connection.getEntityOrThrow(ctx, order_entity_1.Order, orderId, {
            channelId: ctx.channelId,
            relations: ['promotions'],
        });
        return order.promotions.map(p => this.translator.translate(p, ctx)) || [];
    }
    /**
     * @description
     * Returns the next possible states that the Order may transition to.
     */
    getNextOrderStates(order) {
        return this.orderStateMachine.getNextStates(order);
    }
    /**
     * @description
     * Sets the shipping address for the Order.
     */
    async setShippingAddress(ctx, orderId, input) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const country = await this.countryService.findOneByCode(ctx, input.countryCode);
        const shippingAddress = Object.assign(Object.assign({}, input), { countryCode: input.countryCode, country: country.name });
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .update(order_entity_1.Order)
            .set({ shippingAddress })
            .where('id = :id', { id: order.id })
            .execute();
        order.shippingAddress = shippingAddress;
        // Since a changed ShippingAddress could alter the activeTaxZone,
        // we will remove any cached activeTaxZone, so it can be re-calculated
        // as needed.
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone(ctx.channelId), undefined);
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone_PPA(ctx.channelId), undefined);
        return this.applyPriceAdjustments(ctx, order, order.lines);
    }
    /**
     * @description
     * Sets the billing address for the Order.
     */
    async setBillingAddress(ctx, orderId, input) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const country = await this.countryService.findOneByCode(ctx, input.countryCode);
        const billingAddress = Object.assign(Object.assign({}, input), { countryCode: input.countryCode, country: country.name });
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .update(order_entity_1.Order)
            .set({ billingAddress })
            .where('id = :id', { id: order.id })
            .execute();
        order.billingAddress = billingAddress;
        // Since a changed BillingAddress could alter the activeTaxZone,
        // we will remove any cached activeTaxZone, so it can be re-calculated
        // as needed.
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone(ctx.channelId), undefined);
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone_PPA(ctx.channelId), undefined);
        return this.applyPriceAdjustments(ctx, order, order.lines);
    }
    /**
     * @description
     * Unsets the shipping address for the Order.
     *
     * @since 3.1.0
     */
    async unsetShippingAddress(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .update(order_entity_1.Order)
            .set({ shippingAddress: {} })
            .where('id = :id', { id: order.id })
            .execute();
        order.shippingAddress = {};
        // Since a changed ShippingAddress could alter the activeTaxZone,
        // we will remove any cached activeTaxZone, so it can be re-calculated
        // as needed.
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone(ctx.channelId), undefined);
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone_PPA(ctx.channelId), undefined);
        return this.applyPriceAdjustments(ctx, order, order.lines);
    }
    /**
     * @description
     * Unsets the billing address for the Order.
     *
     * @since 3.1.0
     */
    async unsetBillingAddress(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .update(order_entity_1.Order)
            .set({ billingAddress: {} })
            .where('id = :id', { id: order.id })
            .execute();
        order.billingAddress = {};
        // Since a changed BillingAddress could alter the activeTaxZone,
        // we will remove any cached activeTaxZone, so it can be re-calculated
        // as needed.
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone(ctx.channelId), undefined);
        this.requestCache.set(ctx, constants_1.CacheKey.ActiveTaxZone_PPA(ctx.channelId), undefined);
        return this.applyPriceAdjustments(ctx, order, order.lines);
    }
    /**
     * @description
     * Returns an array of quotes stating which {@link ShippingMethod}s may be applied to this Order.
     * This is determined by the configured {@link ShippingEligibilityChecker} of each ShippingMethod.
     *
     * The quote also includes a price for each method, as determined by the configured
     * {@link ShippingCalculator} of each eligible ShippingMethod.
     */
    async getEligibleShippingMethods(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const eligibleMethods = await this.shippingCalculator.getEligibleShippingMethods(ctx, order);
        return eligibleMethods.map(eligible => {
            const { price, taxRate, priceIncludesTax, metadata } = eligible.result;
            return {
                id: eligible.method.id,
                price: priceIncludesTax ? (0, tax_utils_1.netPriceOf)(price, taxRate) : price,
                priceWithTax: priceIncludesTax ? price : (0, tax_utils_1.grossPriceOf)(price, taxRate),
                description: eligible.method.description,
                name: eligible.method.name,
                code: eligible.method.code,
                metadata,
                customFields: eligible.method.customFields,
            };
        });
    }
    /**
     * @description
     * Returns an array of quotes stating which {@link PaymentMethod}s may be used on this Order.
     */
    async getEligiblePaymentMethods(ctx, orderId) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        return this.paymentMethodService.getEligiblePaymentMethods(ctx, order);
    }
    /**
     * @description
     * Sets the ShippingMethod to be used on this Order.
     */
    async setShippingMethod(ctx, orderId, shippingMethodIds) {
        const order = await this.getOrderOrThrow(ctx, orderId);
        const validationError = this.assertAddingItemsState(order);
        if (validationError) {
            return validationError;
        }
        const result = await this.orderModifier.setShippingMethods(ctx, order, shippingMethodIds);
        if ((0, error_result_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        const updatedOrder = await this.getOrderOrThrow(ctx, orderId);
        await this.applyPriceAdjustments(ctx, updatedOrder);
        return this.connection.getRepository(ctx, order_entity_1.Order).save(updatedOrder);
    }
    /**
     * @description
     * Transitions the Order to the given state.
     */
    async transitionToState(ctx, orderId, state) {
        // Wrapped in withTransaction so that the in-memory state mutation, the
        // first save, the onTransitionEnd hooks (which themselves perform DB
        // writes — stock allocations, history entries, OrderPlacedStrategy
        // mutations) and the second save all commit or roll back together.
        // Without this, a throwing onTransitionEnd would leave the order in a
        // half-committed state (state=new, active=true, orderPlacedAt=null).
        // Joins any existing transaction in ctx, so callers that already have
        // @Transaction() are unaffected. See #4686.
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const order = await this.getOrderOrThrow(txCtx, orderId);
            order.payments = await this.getOrderPayments(txCtx, orderId);
            const fromState = order.state;
            let finalize;
            try {
                const result = await this.orderStateMachine.transition(txCtx, order, state);
                finalize = result.finalize;
            }
            catch (e) {
                const transitionError = txCtx.translate(e.message, { fromState, toState: state });
                return new generated_graphql_shop_errors_1.OrderStateTransitionError({ transitionError, fromState, toState: state });
            }
            await this.connection.getRepository(txCtx, order_entity_1.Order).save(order, { reload: false });
            await this.eventBus.publish(new order_state_transition_event_1.OrderStateTransitionEvent(fromState, state, txCtx, order));
            await finalize();
            await this.connection.getRepository(txCtx, order_entity_1.Order).save(order, { reload: false });
            return order;
        });
    }
    /**
     * @description
     * Transitions a Fulfillment to the given state and then transitions the Order state based on
     * whether all Fulfillments of the Order are shipped or delivered.
     */
    async transitionFulfillmentToState(ctx, fulfillmentId, state) {
        const result = await this.fulfillmentService.transitionToState(ctx, fulfillmentId, state);
        if ((0, error_result_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        return result.fulfillment;
    }
    /**
     * @description
     * Transitions a Refund to the given state
     */
    async transitionRefundToState(ctx, refundId, state, transactionId) {
        // Wrapped in withTransaction so the state save and onTransitionEnd hooks
        // are atomic — see the equivalent comment on transitionToState. #4686.
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const refund = await this.connection.getEntityOrThrow(txCtx, refund_entity_1.Refund, refundId, {
                relations: ['payment', 'payment.order'],
            });
            if (transactionId && refund.transactionId !== transactionId) {
                refund.transactionId = transactionId;
            }
            const fromState = refund.state;
            const toState = state;
            const { finalize } = await this.refundStateMachine.transition(txCtx, refund.payment.order, refund, toState);
            await this.connection.getRepository(txCtx, refund_entity_1.Refund).save(refund);
            await finalize();
            await this.eventBus.publish(new refund_state_transition_event_1.RefundStateTransitionEvent(fromState, toState, txCtx, refund, refund.payment.order));
            return refund;
        });
    }
    /**
     * @description
     * Allows the Order to be modified, which allows several aspects of the Order to be changed:
     *
     * * Changes to OrderLine quantities
     * * New OrderLines being added
     * * Arbitrary {@link Surcharge}s being added
     * * Shipping or billing address changes
     *
     * Setting the `dryRun` input property to `true` will apply all changes, including updating the price of the
     * Order, except history entry and additional payment actions.
     *
     * __Using dryRun option, you must wrap function call in transaction manually.__
     *
     */
    async modifyOrder(ctx, input) {
        const order = await this.getOrderOrThrow(ctx, input.orderId);
        const result = await this.orderModifier.modifyOrder(ctx, input, order);
        if ((0, error_result_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        if (input.dryRun) {
            return result.order;
        }
        await this.historyService.createHistoryEntryForOrder({
            ctx,
            orderId: input.orderId,
            type: generated_types_1.HistoryEntryType.ORDER_MODIFIED,
            data: {
                modificationId: result.modification.id,
            },
        });
        return this.getOrderOrThrow(ctx, input.orderId);
    }
    /**
     * @description
     * Transitions the given {@link Payment} to a new state.
     */
    async transitionPaymentToState(ctx, paymentId, state) {
        return this.paymentService.transitionToState(ctx, paymentId, state);
    }
    /**
     * @description
     * Adds a new Payment to the Order. If the Order totalWithTax is covered by Payments, then the Order
     * state will get automatically transitioned to the `PaymentSettled` or `PaymentAuthorized` state.
     */
    async addPaymentToOrder(ctx, orderId, input) {
        this.assertInTransaction(ctx, 'OrderService.addPaymentToOrder');
        const order = await this.getOrderOrThrow(ctx, orderId);
        if (!this.canAddPaymentToOrder(order)) {
            return new generated_graphql_shop_errors_1.OrderPaymentStateError();
        }
        const totalWithTaxBeforeRevalidation = order.totalWithTax;
        const couponsRemoved = await this.revalidateCouponCodesForOrder(ctx, order);
        // Re-fetch order if coupons were removed, so totals reflect recalculated prices
        const freshOrder = couponsRemoved ? await this.getOrderOrThrow(ctx, orderId) : order;
        if (couponsRemoved && totalWithTaxBeforeRevalidation < freshOrder.totalWithTax) {
            // A coupon was stripped during revalidation AND that strip
            // increased what the customer would be charged (e.g. a
            // usage-limited coupon's slot was claimed by a concurrent
            // checkout). Do not proceed to charge the customer at the new
            // amount — surface a typed error so the storefront can refresh
            // the order and re-confirm. The coupon strip itself is committed
            // alongside this error so subsequent addPaymentToOrder attempts
            // see the recalculated totals.
            //
            // Strips that do not change the total (e.g. a coupon whose
            // promotion was already deleted and no longer affecting pricing,
            // or a coupon stacked on top of another that already maxed out
            // the discount) fall through silently — there is no surprise
            // charge to surface, and rejecting in those cases would create
            // unnecessary friction.
            //
            // PaymentFailedError is reused here to avoid a breaking change
            // to the AddPaymentToOrderResult union on the master branch.
            // A dedicated CouponRemovedDuringCheckoutError is planned as a
            // follow-up on the minor branch — see
            // https://github.com/vendurehq/vendure/pull/4660.
            return new generated_graphql_shop_errors_1.PaymentFailedError({
                paymentErrorMessage: 'Order total changed during checkout because a coupon is no longer available. Please refresh your order and retry.',
            });
        }
        freshOrder.payments = await this.getOrderPayments(ctx, freshOrder.id);
        const amountToPay = freshOrder.totalWithTax - (0, order_utils_1.totalCoveredByPayments)(freshOrder);
        const payment = await this.paymentService.createPayment(ctx, freshOrder, amountToPay, input.method, input.metadata);
        if ((0, error_result_1.isGraphQlErrorResult)(payment)) {
            return payment;
        }
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder()
            .relation('payments')
            .of(freshOrder)
            .add(payment);
        if (payment.state === 'Error') {
            return new generated_graphql_shop_errors_1.PaymentFailedError({ paymentErrorMessage: payment.errorMessage || '' });
        }
        if (payment.state === 'Declined') {
            return new generated_graphql_shop_errors_1.PaymentDeclinedError({ paymentErrorMessage: payment.errorMessage || '' });
        }
        return (0, utils_1.assertFound)(this.findOne(ctx, freshOrder.id));
    }
    /**
     * Re-validates all coupon codes on the order with a pessimistic lock on
     * the Promotion rows. This serializes concurrent payment attempts so that
     * only one order can "claim" a usage-limited coupon at a time.
     * If a coupon is no longer valid (e.g. usage limit reached), it is removed
     * from the order and the order totals are recalculated.
     * Returns true if any coupons were removed, false otherwise.
     *
     * Note on selection semantics: the lock guarantees the bug case ("everyone
     * wins" — N orders all keeping a `usageLimit: 1` coupon) is impossible.
     * The exact resolution under contention depends on the database's
     * transaction-isolation default:
     *
     *   - Postgres (READ COMMITTED): each non-locking SELECT sees the
     *     latest committed data. The first lock holder observes N-1 other
     *     orders associated with the promotion (because `countPromotionUsages`
     *     joins through `order.promotions` and counts `ArrangingPayment`
     *     orders) and fails validation, so its coupon is stripped. Each
     *     subsequent lock holder sees one fewer associated order, and the
     *     final lock holder sees zero and succeeds. Net: exactly one winner,
     *     specifically whichever order acquires the lock last ("last-wins").
     *
     *   - MySQL/MariaDB (REPEATABLE READ): the consistent-read snapshot is
     *     established by the very first non-locking SELECT in the resolver's
     *     transaction (the order lookup at the top of `addPaymentToOrder`),
     *     before this lock is acquired. Every subsequent non-locking SELECT
     *     in the same transaction reads from that fixed snapshot, so each
     *     concurrent transaction's count query still sees the *other* orders
     *     as holding the coupon. Result: every contender sees `count >= 1`
     *     and strips, yielding zero winners. This is over-protective rather
     *     than buggy — the over-application invariant still holds — but it
     *     is a worse outcome than Postgres's last-wins. Closing this gap
     *     properly requires either bypassing the snapshot for the count
     *     query (`SELECT ... FOR UPDATE`) or restructuring so the lock
     *     query is the very first read in the transaction; both come with
     *     trade-offs (gap locks, broader scope) and are deferred.
     *
     * Do not "fix" the resolution into first-wins without re-deriving the
     * count semantics from scratch.
     *
     * See https://github.com/vendurehq/vendure/pull/4660
     */
    async revalidateCouponCodesForOrder(ctx, order) {
        var _a;
        let removedAny = false;
        for (const couponCode of [...order.couponCodes]) {
            // Resolve the promotion in the current channel before locking so
            // that the lock query can target the promotion's primary key. PK
            // lookups always hit an index, take a single-row lock on every
            // supported DB, and avoid the gap-locking behaviour MySQL/MariaDB
            // would otherwise exhibit when filtering by `couponCode` (which
            // has no dedicated index).
            const promotion = await this.connection.getRepository(ctx, promotion_entity_1.Promotion).findOne({
                where: {
                    couponCode,
                    enabled: true,
                    deletedAt: (0, typeorm_1.IsNull)(),
                    channels: { id: ctx.channelId },
                },
            });
            if (promotion) {
                // Acquire a pessimistic write lock on the promotion row to
                // serialize concurrent payment attempts. The lock is held
                // until the resolver's @Transaction() commits. On SQLite the
                // lock is not supported; SQLite serializes writes at the
                // engine level instead.
                try {
                    await this.connection
                        .getRepository(ctx, promotion_entity_1.Promotion)
                        .createQueryBuilder('promotion')
                        .setLock('pessimistic_write')
                        .where('promotion.id = :id', { id: promotion.id })
                        .getOne();
                }
                catch (e) {
                    if (!(e instanceof typeorm_1.LockNotSupportedOnGivenDriverError)) {
                        throw e;
                    }
                    // Lock not supported (e.g. SQLite) — continue without it
                }
            }
            const validationResult = await this.promotionService.validateCouponCode(ctx, couponCode, (_a = order.customer) === null || _a === void 0 ? void 0 : _a.id, order.id);
            if ((0, error_result_1.isGraphQlErrorResult)(validationResult)) {
                order.couponCodes = order.couponCodes.filter(c => c !== couponCode);
                removedAny = true;
            }
        }
        if (removedAny) {
            await this.applyPriceAdjustments(ctx, order);
        }
        return removedAny;
    }
    /**
     * Throws if the given RequestContext is not associated with an active
     * database transaction. Used to guard methods whose correctness depends
     * on a wrapping transaction — both for atomicity (so a partial failure
     * rolls back rather than leaving the order in a half-updated state) and
     * to ensure the pessimistic lock acquired by `revalidateCouponCodesForOrder`
     * is held for the duration of the payment work, not silently released
     * by an autocommit one-statement transaction.
     *
     * Resolvers reach these methods through the `@Transaction()` decorator,
     * which is the supported entry path. Callers from outside the resolver
     * layer (background jobs, plugin services, lifecycle hooks) must wrap
     * the call themselves via `TransactionalConnection.startTransaction()`
     * or the equivalent helper.
     */
    assertInTransaction(ctx, methodName) {
        const entityManager = ctx[constants_1.TRANSACTION_MANAGER_KEY];
        const queryRunner = entityManager === null || entityManager === void 0 ? void 0 : entityManager.queryRunner;
        if (!queryRunner || queryRunner.isReleased) {
            throw new errors_1.InternalServerError(`${methodName} must be called within a transaction. ` +
                'Wrap the call with the @Transaction() resolver decorator, or — when ' +
                'invoking from outside a resolver — start a transaction via ' +
                'TransactionalConnection.startTransaction() before calling.');
        }
    }
    /**
     * We can add a Payment to the order if:
     * 1. the Order is in the `ArrangingPayment` state or
     * 2. the Order's current state can transition to `PaymentAuthorized` and `PaymentSettled`
     */
    canAddPaymentToOrder(order) {
        if (order.state === 'ArrangingPayment') {
            return true;
        }
        const canTransitionToPaymentAuthorized = this.orderStateMachine.canTransition(order.state, 'PaymentAuthorized');
        const canTransitionToPaymentSettled = this.orderStateMachine.canTransition(order.state, 'PaymentSettled');
        return canTransitionToPaymentAuthorized && canTransitionToPaymentSettled;
    }
    /**
     * @description
     * This method is used after modifying an existing completed order using the `modifyOrder()` method. If the modifications
     * cause the order total to increase (such as when adding a new OrderLine), then there will be an outstanding charge to
     * pay.
     *
     * This method allows you to add a new Payment and assumes the actual processing has been done manually, e.g. in the
     * dashboard of your payment provider.
     */
    async addManualPaymentToOrder(ctx, input) {
        this.assertInTransaction(ctx, 'OrderService.addManualPaymentToOrder');
        const order = await this.getOrderOrThrow(ctx, input.orderId);
        if (order.state !== 'ArrangingAdditionalPayment' && order.state !== 'ArrangingPayment') {
            return new generated_graphql_admin_errors_1.ManualPaymentStateError();
        }
        const manualCouponsRemoved = await this.revalidateCouponCodesForOrder(ctx, order);
        // Re-fetch order so totals reflect any recalculated prices
        const freshManualOrder = manualCouponsRemoved
            ? await this.getOrderOrThrow(ctx, input.orderId)
            : order;
        const existingPayments = await this.getOrderPayments(ctx, freshManualOrder.id);
        freshManualOrder.payments = existingPayments;
        const amount = freshManualOrder.totalWithTax - (0, order_utils_1.totalCoveredByPayments)(freshManualOrder);
        const modifications = await this.getOrderModifications(ctx, freshManualOrder.id);
        const unsettledModifications = modifications.filter(m => !m.isSettled);
        if (0 < unsettledModifications.length) {
            const outstandingModificationsTotal = (0, shared_utils_1.summate)(unsettledModifications, 'priceChange');
            if (outstandingModificationsTotal !== amount) {
                throw new errors_1.InternalServerError(`The outstanding order amount (${amount}) should equal the unsettled OrderModifications total (${outstandingModificationsTotal})`);
            }
        }
        const payment = await this.paymentService.createManualPayment(ctx, freshManualOrder, amount, input);
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder('order')
            .relation('payments')
            .of(freshManualOrder)
            .add(payment);
        for (const modification of unsettledModifications) {
            modification.payment = payment;
            await this.connection.getRepository(ctx, order_modification_entity_1.OrderModification).save(modification);
        }
        return (0, utils_1.assertFound)(this.findOne(ctx, freshManualOrder.id));
    }
    /**
     * @description
     * Settles a payment by invoking the {@link PaymentMethodHandler}'s `settlePayment()` method. Automatically
     * transitions the Order state if all Payments are settled.
     */
    async settlePayment(ctx, paymentId) {
        const payment = await this.paymentService.settlePayment(ctx, paymentId);
        if (!(0, error_result_1.isGraphQlErrorResult)(payment)) {
            if (payment.state !== 'Settled') {
                return new generated_graphql_admin_errors_1.SettlePaymentError({ paymentErrorMessage: payment.errorMessage || '' });
            }
        }
        return payment;
    }
    /**
     * @description
     * Cancels a payment by invoking the {@link PaymentMethodHandler}'s `cancelPayment()` method (if defined), and transitions the Payment to
     * the `Cancelled` state.
     */
    async cancelPayment(ctx, paymentId) {
        const payment = await this.paymentService.cancelPayment(ctx, paymentId);
        if (!(0, error_result_1.isGraphQlErrorResult)(payment)) {
            if (payment.state !== 'Cancelled') {
                return new generated_graphql_admin_errors_1.CancelPaymentError({ paymentErrorMessage: payment.errorMessage || '' });
            }
        }
        return payment;
    }
    /**
     * @description
     * Creates a new Fulfillment associated with the given Order and OrderItems.
     */
    async createFulfillment(ctx, input) {
        if (!input.lines || input.lines.length === 0 || (0, shared_utils_1.summate)(input.lines, 'quantity') === 0) {
            return new generated_graphql_admin_errors_1.EmptyOrderLineSelectionError();
        }
        const orders = await (0, order_utils_1.getOrdersFromLines)(ctx, this.connection, input.lines);
        if (await this.requestedFulfillmentQuantityExceedsLineQuantity(ctx, input)) {
            return new generated_graphql_admin_errors_1.ItemsAlreadyFulfilledError();
        }
        const stockCheckResult = await this.ensureSufficientStockForFulfillment(ctx, input);
        if ((0, error_result_1.isGraphQlErrorResult)(stockCheckResult)) {
            return stockCheckResult;
        }
        const fulfillment = await this.fulfillmentService.create(ctx, orders, input.lines, input.handler);
        if ((0, error_result_1.isGraphQlErrorResult)(fulfillment)) {
            return fulfillment;
        }
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .createQueryBuilder()
            .relation('fulfillments')
            .of(orders)
            .add(fulfillment);
        for (const order of orders) {
            await this.historyService.createHistoryEntryForOrder({
                ctx,
                orderId: order.id,
                type: generated_types_1.HistoryEntryType.ORDER_FULFILLMENT,
                data: {
                    fulfillmentId: fulfillment.id,
                },
            });
        }
        const result = await this.fulfillmentService.transitionToState(ctx, fulfillment.id, 'Pending');
        if ((0, error_result_1.isGraphQlErrorResult)(result)) {
            return result;
        }
        return result.fulfillment;
    }
    async requestedFulfillmentQuantityExceedsLineQuantity(ctx, input) {
        const existingFulfillmentLines = await this.connection
            .getRepository(ctx, fulfillment_line_entity_1.FulfillmentLine)
            .createQueryBuilder('fulfillmentLine')
            .leftJoinAndSelect('fulfillmentLine.orderLine', 'orderLine')
            .leftJoinAndSelect('fulfillmentLine.fulfillment', 'fulfillment')
            .where('fulfillmentLine.orderLineId IN (:...orderLineIds)', {
            orderLineIds: input.lines.map(l => l.orderLineId),
        })
            .andWhere('fulfillment.state != :state', { state: 'Cancelled' })
            .getMany();
        for (const inputLine of input.lines) {
            const fulfillmentLinesForOrderLine = existingFulfillmentLines.filter(l => (0, utils_1.idsAreEqual)(l.orderLineId, inputLine.orderLineId));
            if (fulfillmentLinesForOrderLine.length) {
                const fulfilledQuantity = (0, shared_utils_1.summate)(fulfillmentLinesForOrderLine, 'quantity');
                const unfulfilledQuantity = fulfillmentLinesForOrderLine[0].orderLine.quantity - fulfilledQuantity;
                if (unfulfilledQuantity < inputLine.quantity) {
                    return true;
                }
            }
            else {
                const orderLine = await this.connection.getEntityOrThrow(ctx, order_line_entity_1.OrderLine, inputLine.orderLineId);
                if (orderLine.quantity < inputLine.quantity) {
                    return true;
                }
            }
        }
        return false;
    }
    async ensureSufficientStockForFulfillment(ctx, input) {
        const lines = await this.connection.getRepository(ctx, order_line_entity_1.OrderLine).find({
            where: {
                id: (0, typeorm_1.In)(input.lines.map(l => l.orderLineId)),
            },
            relations: ['productVariant'],
        });
        for (const line of lines) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const lineInput = input.lines.find(l => (0, utils_1.idsAreEqual)(l.orderLineId, line.id));
            const fulfillableStockLevel = await this.productVariantService.getFulfillableStockLevel(ctx, line.productVariant);
            if (fulfillableStockLevel < lineInput.quantity) {
                const { stockOnHand } = await this.stockLevelService.getAvailableStock(ctx, line.productVariant.id);
                const productVariant = this.translator.translate(line.productVariant, ctx);
                return new generated_graphql_admin_errors_1.InsufficientStockOnHandError({
                    productVariantId: productVariant.id,
                    productVariantName: productVariant.name,
                    stockOnHand,
                });
            }
        }
    }
    /**
     * @description
     * Returns an array of all Fulfillments associated with the Order.
     */
    async getOrderFulfillments(ctx, order) {
        const { fulfillments } = await this.connection.getEntityOrThrow(ctx, order_entity_1.Order, order.id, {
            relations: ['fulfillments'],
        });
        return fulfillments;
    }
    /**
     * @description
     * Returns an array of all Surcharges associated with the Order.
     */
    async getOrderSurcharges(ctx, orderId) {
        const order = await this.connection.getEntityOrThrow(ctx, order_entity_1.Order, orderId, {
            channelId: ctx.channelId,
            relations: ['surcharges'],
            relationLoadStrategy: 'query',
        });
        return order.surcharges || [];
    }
    /**
     * @description
     * Cancels an Order by transitioning it to the `Cancelled` state. If stock is being tracked for the ProductVariants
     * in the Order, then new {@link StockMovement}s will be created to correct the stock levels.
     */
    async cancelOrder(ctx, input) {
        let allOrderItemsCancelled = false;
        const cancelResult = input.lines != null
            ? await this.orderModifier.cancelOrderByOrderLines(ctx, input, input.lines)
            : await this.cancelOrderById(ctx, input);
        if ((0, error_result_1.isGraphQlErrorResult)(cancelResult)) {
            return cancelResult;
        }
        else {
            allOrderItemsCancelled = cancelResult;
        }
        if (allOrderItemsCancelled) {
            const transitionResult = await this.transitionToState(ctx, input.orderId, 'Cancelled');
            if ((0, error_result_1.isGraphQlErrorResult)(transitionResult)) {
                return transitionResult;
            }
        }
        return (0, utils_1.assertFound)(this.findOne(ctx, input.orderId));
    }
    async cancelOrderById(ctx, input) {
        const order = await this.getOrderOrThrow(ctx, input.orderId);
        if (order.active) {
            return true;
        }
        else {
            const lines = order.lines.map(l => ({
                orderLineId: l.id,
                quantity: l.quantity,
            }));
            return this.orderModifier.cancelOrderByOrderLines(ctx, input, lines);
        }
    }
    /**
     * @description
     * Creates a {@link Refund} against the order and in doing so invokes the `createRefund()` method of the
     * {@link PaymentMethodHandler}.
     */
    async refundOrder(ctx, input) {
        var _a;
        if ((!input.lines || input.lines.length === 0 || (0, shared_utils_1.summate)(input.lines, 'quantity') === 0) &&
            input.shipping === 0 &&
            !input.amount) {
            return new generated_graphql_admin_errors_1.NothingToRefundError();
        }
        const orders = await (0, order_utils_1.getOrdersFromLines)(ctx, this.connection, (_a = input.lines) !== null && _a !== void 0 ? _a : []);
        if (1 < orders.length) {
            return new generated_graphql_admin_errors_1.MultipleOrderError();
        }
        const payment = await this.connection.getEntityOrThrow(ctx, payment_entity_1.Payment, input.paymentId, {
            relations: ['order'],
        });
        if (orders && orders.length && !(0, utils_1.idsAreEqual)(payment.order.id, orders[0].id)) {
            return new generated_graphql_admin_errors_1.PaymentOrderMismatchError();
        }
        const order = payment.order;
        if (order.state === 'AddingItems' ||
            order.state === 'ArrangingPayment' ||
            order.state === 'PaymentAuthorized') {
            return new generated_graphql_admin_errors_1.RefundOrderStateError({ orderState: order.state });
        }
        const createdRefund = await this.paymentService.createRefund(ctx, input, order, payment);
        if (createdRefund instanceof refund_entity_1.Refund) {
            await this.eventBus.publish(new refund_event_1.RefundEvent(ctx, order, createdRefund, 'created'));
        }
        return createdRefund;
    }
    /**
     * @description
     * Settles a Refund by transitioning it to the `Settled` state.
     */
    async settleRefund(ctx, input) {
        // Wrapped in withTransaction so the state save and onTransitionEnd hooks
        // are atomic — see the equivalent comment on transitionToState. #4686.
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const refund = await this.connection.getEntityOrThrow(txCtx, refund_entity_1.Refund, input.id, {
                relations: ['payment', 'payment.order'],
            });
            refund.transactionId = input.transactionId;
            const fromState = refund.state;
            const toState = 'Settled';
            const { finalize } = await this.refundStateMachine.transition(txCtx, refund.payment.order, refund, toState);
            await this.connection.getRepository(txCtx, refund_entity_1.Refund).save(refund);
            await finalize();
            await this.eventBus.publish(new refund_state_transition_event_1.RefundStateTransitionEvent(fromState, toState, txCtx, refund, refund.payment.order));
            return refund;
        });
    }
    /**
     * @description
     * Associates a Customer with the Order.
     */
    async addCustomerToOrder(ctx, orderIdOrOrder, customer) {
        const order = orderIdOrOrder instanceof order_entity_1.Order
            ? orderIdOrOrder
            : await this.getOrderOrThrow(ctx, orderIdOrOrder);
        order.customer = customer;
        await this.connection.getRepository(ctx, order_entity_1.Order).save(order, { reload: false });
        let updatedOrder = order;
        // Check that any applied couponCodes are still valid now that
        // we know the Customer.
        if (order.active && order.couponCodes) {
            for (const couponCode of order.couponCodes.slice()) {
                const validationResult = await this.promotionService.validateCouponCode(ctx, couponCode, customer.id);
                if ((0, error_result_1.isGraphQlErrorResult)(validationResult)) {
                    updatedOrder = await this.removeCouponCode(ctx, order.id, couponCode);
                }
            }
        }
        return updatedOrder;
    }
    /**
     * @description
     * Creates a new "ORDER_NOTE" type {@link OrderHistoryEntry} in the Order's history timeline.
     */
    async addNoteToOrder(ctx, input) {
        const order = await this.getOrderOrThrow(ctx, input.id);
        await this.historyService.createHistoryEntryForOrder({
            ctx,
            orderId: order.id,
            type: generated_types_1.HistoryEntryType.ORDER_NOTE,
            data: {
                note: input.note,
            },
        }, input.isPublic);
        return order;
    }
    async updateOrderNote(ctx, input) {
        var _a;
        return this.historyService.updateOrderHistoryEntry(ctx, {
            type: generated_types_1.HistoryEntryType.ORDER_NOTE,
            data: input.note ? { note: input.note } : undefined,
            isPublic: (_a = input.isPublic) !== null && _a !== void 0 ? _a : undefined,
            ctx,
            entryId: input.noteId,
        });
    }
    async deleteOrderNote(ctx, id) {
        try {
            await this.historyService.deleteOrderHistoryEntry(ctx, id);
            return {
                result: generated_types_1.DeletionResult.DELETED,
            };
        }
        catch (e) {
            return {
                result: generated_types_1.DeletionResult.NOT_DELETED,
                message: e.message,
            };
        }
    }
    /**
     * @description
     * Deletes an Order, ensuring that any Sessions that reference this Order are dereferenced before deletion.
     *
     * @since 1.5.0
     */
    async deleteOrder(ctx, orderOrId) {
        const orderToDelete = orderOrId instanceof order_entity_1.Order
            ? orderOrId
            : await this.connection
                .getRepository(ctx, order_entity_1.Order)
                .findOneOrFail({ where: { id: orderOrId }, relations: ['lines', 'shippingLines'] });
        // If there is a Session referencing the Order to be deleted, we must first remove that
        // reference in order to avoid a foreign key error. See https://github.com/vendurehq/vendure/issues/1454
        const sessions = await this.connection
            .getRepository(ctx, session_entity_1.Session)
            .find({ where: { activeOrderId: orderToDelete.id } });
        if (sessions.length) {
            await this.connection
                .getRepository(ctx, session_entity_1.Session)
                .update(sessions.map(s => s.id), { activeOrder: null });
        }
        const deletedOrder = new order_entity_1.Order(orderToDelete);
        await this.connection.getRepository(ctx, order_entity_1.Order).delete(orderToDelete.id);
        await this.eventBus.publish(new order_event_1.OrderEvent(ctx, deletedOrder, 'deleted'));
    }
    /**
     * @description
     * When a guest user with an anonymous Order signs in and has an existing Order associated with that Customer,
     * we need to reconcile the contents of the two orders.
     *
     * The logic used to do the merging is specified in the {@link OrderOptions} `mergeStrategy` config setting.
     */
    async mergeOrders(ctx, user, guestOrder, existingOrder) {
        if (guestOrder && guestOrder.customer) {
            // In this case the "guest order" is actually an order of an existing Customer,
            // so we do not want to merge at all. See https://github.com/vendurehq/vendure/issues/263
            return existingOrder;
        }
        try {
            return await this.connection.withTransaction(ctx, async (txCtx) => {
                // Acquire a pessimistic lock on the existing order to prevent concurrent merges
                // from interleaving their DB operations. See https://github.com/vendurehq/vendure/issues/4481
                // Note: SQLite does not support pessimistic locks — the try-catch ensures we
                // degrade gracefully (SQLite serializes writes at the engine level anyway).
                if (existingOrder) {
                    try {
                        await this.connection
                            .getRepository(txCtx, order_entity_1.Order)
                            .createQueryBuilder('order')
                            .setLock('pessimistic_write')
                            .where('order.id = :id', { id: existingOrder.id })
                            .getOne();
                    }
                    catch (_a) {
                        // Lock not supported (e.g. SQLite) — continue without it
                    }
                }
                // Re-read the guest order after acquiring the lock. A concurrent merge may have
                // already deleted it, in which case there is nothing left to merge.
                const freshGuestOrder = guestOrder ? await this.findOne(txCtx, guestOrder.id) : undefined;
                if (!freshGuestOrder && guestOrder) {
                    return existingOrder;
                }
                const mergeResult = await this.orderMerger.merge(txCtx, freshGuestOrder, existingOrder);
                const { orderToDelete, linesToInsert, linesToDelete, linesToModify } = mergeResult;
                let { order } = mergeResult;
                if (orderToDelete) {
                    try {
                        // Nested savepoint to isolate foreign key failure, so it doesn't
                        // roll back the entire merge transaction
                        await this.connection.withTransaction(txCtx, async (innerCtx) => {
                            await this.deleteOrder(innerCtx, orderToDelete);
                        });
                    }
                    catch (e) {
                        if (!(0, db_errors_1.isForeignKeyViolationError)(e))
                            throw e;
                        if (!order)
                            throw new Error(`Cannot complete order merge: active order not found, while cancelling order ${orderToDelete.id}`);
                        // If the order has a foreign key violation (e.g. with cancelled payments),
                        // instead of deleting it we cancel the order and leave a note with an explanation.
                        // This way the previous order and all its information are preserved.
                        await this.cancelOrder(txCtx, { orderId: orderToDelete.id });
                        const note = [
                            'This order was cancelled during user sign-in because merging with the active order was not possible.',
                            `The active order is ${order.code}. This order has been preserved for reference.`,
                        ].join(' ');
                        await this.historyService.createHistoryEntryForOrder({
                            ctx: txCtx,
                            orderId: orderToDelete.id,
                            type: generated_types_1.HistoryEntryType.ORDER_NOTE,
                            data: { note },
                        }, false);
                    }
                }
                if (order && linesToDelete) {
                    const orderId = order.id;
                    for (const line of linesToDelete) {
                        const result = await this.removeItemFromOrder(txCtx, orderId, line.orderLineId);
                        if (!(0, error_result_1.isGraphQlErrorResult)(result)) {
                            order = result;
                        }
                    }
                }
                if (order && linesToInsert) {
                    const orderId = order.id;
                    const result = await this.addItemsToOrder(txCtx, orderId, linesToInsert);
                    order = result.order;
                }
                if (order && linesToModify) {
                    const orderId = order.id;
                    const result = await this.adjustOrderLines(txCtx, orderId, linesToModify);
                    order = result.order;
                }
                if (order && linesToDelete) {
                    const orderId = order.id;
                    try {
                        const result = await this.removeItemsFromOrder(txCtx, orderId, linesToDelete.map(l => l.orderLineId));
                        if (!(0, error_result_1.isGraphQlErrorResult)(result)) {
                            order = result;
                        }
                    }
                    catch (e) {
                        vendure_logger_1.Logger.error(e.message, undefined, e.stack);
                    }
                }
                const customer = await this.customerService.findOneByUserId(txCtx, user.id);
                if (order && customer) {
                    order.customer = customer;
                    await this.connection.getRepository(txCtx, order_entity_1.Order).save(order, { reload: false });
                }
                return order;
            });
        }
        catch (e) {
            // If the merge fails for any reason, log the error and return the existing order
            // unchanged rather than failing the entire login flow.
            const error = e instanceof Error ? e : new Error(String(e));
            vendure_logger_1.Logger.error(`Failed to merge orders: ${error.message}`, undefined, error.stack);
            return existingOrder;
        }
    }
    async getOrderOrThrow(ctx, orderId, relations) {
        const order = await this.findOne(ctx, orderId, relations !== null && relations !== void 0 ? relations : [
            'lines',
            'lines.productVariant',
            'lines.productVariant.productVariantPrices',
            'shippingLines',
            'surcharges',
            'customer',
        ]);
        if (!order) {
            throw new errors_1.EntityNotFoundError('Order', orderId);
        }
        return order;
    }
    getOrderLineOrThrow(order, orderLineId) {
        const orderLine = order.lines.find(line => (0, utils_1.idsAreEqual)(line.id, orderLineId));
        if (!orderLine) {
            throw new errors_1.UserInputError('error.order-does-not-contain-line-with-id', { id: orderLineId });
        }
        return orderLine;
    }
    /**
     * Returns error if quantity is negative.
     */
    assertQuantityIsPositive(quantity) {
        if (quantity < 0) {
            return new generated_graphql_shop_errors_1.NegativeQuantityError();
        }
    }
    /**
     * Returns error if the Order is not in the "AddingItems" or "Draft" state.
     */
    assertAddingItemsState(order) {
        if (order.state !== 'AddingItems' && order.state !== 'Draft') {
            return new generated_graphql_shop_errors_1.OrderModificationError();
        }
    }
    /**
     * Throws if adding the given quantity would take the total order items over the
     * maximum limit specified in the config.
     */
    assertNotOverOrderItemsLimit(order, quantityToAdd) {
        const currentItemsCount = (0, shared_utils_1.summate)(order.lines, 'quantity');
        const { orderItemsLimit } = this.configService.orderOptions;
        if (orderItemsLimit < currentItemsCount + quantityToAdd) {
            return new generated_graphql_shop_errors_1.OrderLimitError({ maxItems: orderItemsLimit });
        }
    }
    /**
     * Throws if adding the given quantity would exceed the maximum allowed
     * quantity for one order line.
     */
    assertNotOverOrderLineItemsLimit(orderLine, quantityToAdd) {
        const currentQuantity = (orderLine === null || orderLine === void 0 ? void 0 : orderLine.quantity) || 0;
        const { orderLineItemsLimit } = this.configService.orderOptions;
        if (orderLineItemsLimit < currentQuantity + quantityToAdd) {
            return new generated_graphql_shop_errors_1.OrderLimitError({ maxItems: orderLineItemsLimit });
        }
    }
    /**
     * @description
     * Applies promotions, taxes and shipping to the Order. If the `updatedOrderLines` argument is passed in,
     * then all of those OrderLines will have their prices re-calculated using the configured {@link OrderItemPriceCalculationStrategy}.
     */
    async applyPriceAdjustments(ctx, order, updatedOrderLines, relations) {
        var _a;
        const allPromotions = await this.promotionService.getActivePromotionsInChannel(ctx);
        const activePromotionsPre = await this.promotionService.getActivePromotionsOnOrder(ctx, order.id);
        // Filter out auto-applied promotions that have exceeded their usage limits.
        // Coupon-based promotions are already validated in validateCouponCode().
        // Safe to cache per-request: the active promotion list (allPromotions) is stable
        // within a single request, so the exhausted set won't change mid-request.
        const customerId = order.customerId;
        const cacheKey = constants_1.CacheKey.ExhaustedPromotions(ctx.channelId, customerId);
        const exhaustedIds = await this.requestCache.get(ctx, cacheKey, () => this.promotionService.getExhaustedPromotionIds(ctx, allPromotions, customerId));
        const promotions = allPromotions.filter(p => !exhaustedIds.has(p.id.toString()));
        // When changing the Order's currencyCode (on account of passing
        // a different currencyCode into the RequestContext), we need to make sure
        // to update all existing OrderLines to use prices in this new currency.
        if (ctx.currencyCode !== order.currencyCode) {
            updatedOrderLines = order.lines;
            order.currencyCode = ctx.currencyCode;
        }
        if (updatedOrderLines === null || updatedOrderLines === void 0 ? void 0 : updatedOrderLines.length) {
            const { orderItemPriceCalculationStrategy, changedPriceHandlingStrategy } = this.configService.orderOptions;
            for (const updatedOrderLine of updatedOrderLines) {
                const variant = await this.productVariantService.applyChannelPriceAndTax(updatedOrderLine.productVariant, ctx, order);
                let priceResult = await orderItemPriceCalculationStrategy.calculateUnitPrice(ctx, variant, updatedOrderLine.customFields || {}, order, updatedOrderLine.quantity);
                const initialListPrice = (_a = updatedOrderLine.initialListPrice) !== null && _a !== void 0 ? _a : priceResult.price;
                if (initialListPrice !== priceResult.price) {
                    priceResult = await changedPriceHandlingStrategy.handlePriceChange(ctx, priceResult, updatedOrderLine, order);
                }
                if (updatedOrderLine.initialListPrice == null) {
                    updatedOrderLine.initialListPrice = initialListPrice;
                }
                updatedOrderLine.listPrice = priceResult.price;
                updatedOrderLine.listPriceIncludesTax = priceResult.priceIncludesTax;
            }
        }
        // Get the shipping line IDs before doing the order calculation
        // step, which can in some cases change the applied shipping lines.
        const shippingLineIdsPre = order.shippingLines.map(l => l.id);
        const updatedOrder = await this.orderCalculator.applyPriceAdjustments(ctx, order, promotions, updatedOrderLines !== null && updatedOrderLines !== void 0 ? updatedOrderLines : []);
        const shippingLineIdsPost = updatedOrder.shippingLines.map(l => l.id);
        await this.applyChangesToShippingLines(ctx, updatedOrder, shippingLineIdsPre, shippingLineIdsPost);
        // Explicitly omit the shippingAddress and billingAddress properties to avoid
        // a race condition where changing one or the other in parallel can
        // overwrite the other's changes. The other omissions prevent the save
        // function from doing more work than necessary.
        await this.connection
            .getRepository(ctx, order_entity_1.Order)
            .save((0, omit_1.omit)(updatedOrder, [
            'shippingAddress',
            'billingAddress',
            'lines',
            'shippingLines',
            'aggregateOrder',
            'sellerOrders',
            'customer',
            'modifications',
            'customFields',
        ]), {
            reload: false,
        });
        await this.promotionService.runPromotionSideEffects(ctx, order, activePromotionsPre);
        await this.connection.getRepository(ctx, order_line_entity_1.OrderLine).save(updatedOrder.lines, { reload: false });
        await this.connection.getRepository(ctx, shipping_line_entity_1.ShippingLine).save(order.shippingLines, { reload: false });
        return (0, utils_1.assertFound)(this.findOne(ctx, order.id, relations));
    }
    /**
     * Applies changes to the shipping lines of an order, adding or removing the relations
     * in the database.
     */
    async applyChangesToShippingLines(ctx, order, shippingLineIdsPre, shippingLineIdsPost) {
        const removedShippingLineIds = shippingLineIdsPre.filter(id => !shippingLineIdsPost.includes(id));
        const newlyAddedShippingLineIds = shippingLineIdsPost.filter(id => !shippingLineIdsPre.includes(id));
        for (const idToRemove of removedShippingLineIds) {
            await this.connection
                .getRepository(ctx, order_entity_1.Order)
                .createQueryBuilder()
                .relation('shippingLines')
                .of(order)
                .remove(idToRemove);
        }
        for (const idToAdd of newlyAddedShippingLineIds) {
            await this.connection
                .getRepository(ctx, order_entity_1.Order)
                .createQueryBuilder()
                .relation('shippingLines')
                .of(order)
                .add(idToAdd);
        }
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    (0, instrument_decorator_1.Instrument)(),
    __metadata("design:paramtypes", [transactional_connection_1.TransactionalConnection,
        config_service_1.ConfigService,
        product_variant_service_1.ProductVariantService,
        customer_service_1.CustomerService,
        country_service_1.CountryService,
        order_calculator_1.OrderCalculator,
        shipping_calculator_1.ShippingCalculator,
        order_state_machine_1.OrderStateMachine,
        order_merger_1.OrderMerger,
        payment_service_1.PaymentService,
        payment_method_service_1.PaymentMethodService,
        fulfillment_service_1.FulfillmentService,
        list_query_builder_1.ListQueryBuilder,
        refund_state_machine_1.RefundStateMachine,
        history_service_1.HistoryService,
        promotion_service_1.PromotionService,
        event_bus_1.EventBus,
        channel_service_1.ChannelService,
        order_modifier_1.OrderModifier,
        custom_field_relation_service_1.CustomFieldRelationService,
        request_context_cache_service_1.RequestContextCacheService,
        translator_service_1.TranslatorService,
        stock_level_service_1.StockLevelService])
], OrderService);
//# sourceMappingURL=order.service.js.map