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
exports.CampusDeliveryPlugin = void 0;
const core_1 = require("@vendure/core");
const core_2 = require("@nestjs/core");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const campus_building_entity_1 = require("./campus-building.entity");
const capacity_service_1 = require("./capacity.service");
const campus_config_admin_resolver_1 = require("./campus-config-admin.resolver");
const campus_config_service_1 = require("./campus-config.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const custom_fields_1 = require("./custom-fields");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
const dispatch_admin_resolver_1 = require("./dispatch-admin.resolver");
const dispatch_admin_service_1 = require("./dispatch-admin.service");
const dispatch_job_service_1 = require("./dispatch-job.service");
const errand_service_1 = require("./errand.service");
const errand_shop_resolver_1 = require("./errand-shop.resolver");
const errand_shipping_line_assignment_1 = require("./errand-shipping-line-assignment");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const hall_shop_resolver_1 = require("./hall-shop.resolver");
const campus_invoice_resolver_1 = require("./campus-invoice.resolver");
const create_campus_tables_1 = require("./migrations/create-campus-tables");
const min_order_process_1 = require("./min-order.process");
const payment_timeout_admin_resolver_1 = require("./payment-timeout-admin.resolver");
const payment_timeout_admin_service_1 = require("./payment-timeout-admin.service");
const payment_timeout_job_1 = require("./payment-timeout.job");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
const permissions_1 = require("./permissions");
const merchant_admin_resolver_1 = require("./merchant-admin.resolver");
const merchant_admin_service_1 = require("./merchant-admin.service");
const campus_notify_service_1 = require("./campus-notify.service");
const r2_mark_service_1 = require("./r2-mark.service");
const r2_shop_resolver_1 = require("./r2-shop.resolver");
const r4_tag_service_1 = require("./r4-tag.service");
const shipping_profile_ensure_service_1 = require("./shipping-profile-ensure.service");
const rider_admin_resolver_1 = require("./rider-admin.resolver");
const rider_credit_log_entity_1 = require("./rider-credit-log.entity");
const rider_credit_service_1 = require("./rider-credit.service");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_service_1 = require("./rider.service");
const rider_shop_resolver_1 = require("./rider-shop.resolver");
const rider_task_service_1 = require("./rider-task.service");
const rider_task_shop_resolver_1 = require("./rider-task-shop.resolver");
const rider_wallet_service_1 = require("./rider-wallet.service");
const rider_withdrawal_entity_1 = require("./rider-withdrawal.entity");
const shipping_calculator_1 = require("./shipping-calculator");
const slot_lock_service_1 = require("./slot-lock.service");
const waimai_shop_resolver_1 = require("./waimai-shop.resolver");
const waimai_store_service_1 = require("./waimai-store.service");
const PAYMENT_TIMEOUT_COMPENSATION = 'payment-timeout-compensation';
// 补偿扫描（照抄 OrderTimeoutPlugin 模式）：SQL JobQueue 忽略 delay，靠此任务把 overdue 任务重入队
const paymentTimeoutCompensation = new core_1.ScheduledTask({
    id: PAYMENT_TIMEOUT_COMPENSATION,
    description: 'Scan overdue PaymentTimeoutTask records and re-enqueue them',
    schedule: cron => cron.every(5).minutes(),
    async execute({ injector }) {
        await injector.get(payment_timeout_job_1.PaymentTimeoutJob).runCompensation();
    },
});
let CampusDeliveryPlugin = class CampusDeliveryPlugin {
    constructor(eventBus, hallService, r4TagService, moduleRef, notify, paymentTimeout, configService) {
        this.eventBus = eventBus;
        this.hallService = hallService;
        this.r4TagService = r4TagService;
        this.moduleRef = moduleRef;
        this.notify = notify;
        this.paymentTimeout = paymentTimeout;
        this.configService = configService;
    }
    /** vendure Injector 需由 ModuleRef 构造（插件模块类构造器不直接提供 Injector） */
    get injector() {
        return new core_1.Injector(this.moduleRef);
    }
    onApplicationBootstrap() {
        (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)(this.injector.get(core_1.TransactionalConnection));
        (0, min_order_process_1.bindMinOrderConnection)(this.injector.get(core_1.TransactionalConnection));
        // 待付款任务队列（+10min 提醒 / +15min 取消）
        this.injector
            .get(payment_timeout_job_1.PaymentTimeoutJob)
            .init()
            .catch(e => core_1.Logger.error(`PaymentTimeout init failed: ${String(e)}`, 'PaymentTimeout'));
        this.eventBus.ofType(core_1.OrderPlacedEvent).subscribe(({ ctx, order }) => {
            this.hallService.onOrderPlaced(ctx, order).catch(e => core_1.Logger.error(String(e), 'CampusHall'));
            // 下单成功通知（waimai 流程下单即支付完成；进大厅逻辑同源）
            void this.h5BaseUrl(ctx).then(url => this.notify.user(ctx, order.id, 'orderPlaced', undefined, url));
        });
        // R4 到店自取打标（二期 §5.4）：store-pickup 运费方式订单在支付闸门补写 fulfillmentRoute；
        // 取消脱厅（3.3）：订单取消终态时清 hallStatus/指派字段，退出大厅与整组抢单链路；
        // 待付款任务：离开 ArrangingPayment 作废，进入 ArrangingPayment 登记
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(e => {
            this.r4TagService.tagR4(e).catch(err => core_1.Logger.error(`R4 tag failed: ${String(err)}`, 'CampusR4Tag'));
            if (e.toState === 'Cancelled') {
                this.hallService.exitHall(e.ctx, e.order).catch(err => core_1.Logger.error(`Hall exit failed: ${String(err)}`, 'CampusHall'));
                // 用户本人主动取消不推（ctx.activeUserId 存在即本人操作）；商家/系统/超时取消才推
                if (!e.ctx.activeUserId) {
                    void this.h5BaseUrl(e.ctx).then(url => this.notify.user(e.ctx, e.order.id, 'orderCancelled', undefined, url));
                }
            }
            if (e.fromState === 'ArrangingPayment' && e.toState !== 'ArrangingPayment') {
                void this.paymentTimeout.cancelForOrder(Number(e.order.id)).catch(err => core_1.Logger.warn(String(err), 'PaymentTimeout'));
            }
            if (e.toState === 'ArrangingPayment') {
                void this.paymentTimeout
                    .scheduleForOrder(e.ctx, Number(e.order.id), Number(e.ctx.channelId), e.toState)
                    .catch(err => core_1.Logger.warn(`schedule payment timeout failed: ${String(err)}`, 'PaymentTimeout'));
            }
        });
        // 售后进度：Approved / Refunded / RefundFailed 三个用户侧节点（其余状态不推）
        this.eventBus.ofType(after_sales_plugin_1.AfterSalesStateTransitionEvent).subscribe(e => {
            const text = e.toState === 'Approved' ? '售后审核通过'
                : e.toState === 'Refunded' ? '退款已到账'
                    : e.toState === 'RefundFailed' ? '退款失败，请联系客服'
                        : null;
            if (!text)
                return;
            void this.h5BaseUrl(e.ctx).then(url => this.notify.user(e.ctx, e.orderId, 'afterSales', text, url));
        });
        this.injector.get(dispatch_job_service_1.DispatchJobService).start();
    }
    /** h5BaseUrl 取渠道配置（未配置返回 undefined，通知静默不带 url） */
    async h5BaseUrl(ctx) {
        var _a;
        try {
            const cfg = await this.configService.getConfig(ctx);
            return (_a = cfg === null || cfg === void 0 ? void 0 : cfg.h5BaseUrl) !== null && _a !== void 0 ? _a : undefined;
        }
        catch (_b) {
            return undefined;
        }
    }
};
exports.CampusDeliveryPlugin = CampusDeliveryPlugin;
exports.CampusDeliveryPlugin = CampusDeliveryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [campus_zone_entity_1.CampusZone, campus_building_entity_1.CampusBuilding, rider_earning_entity_1.RiderEarning, campus_fulfillment_config_entity_1.CampusFulfillmentConfig, delivery_slot_entity_1.DeliverySlot, rider_credit_log_entity_1.RiderCreditLog, rider_withdrawal_entity_1.RiderWithdrawalRequest, payment_timeout_entity_1.PaymentTimeoutTask],
        providers: [
            create_campus_tables_1.CreateCampusTablesMigration,
            campus_config_service_1.CampusConfigService,
            rider_service_1.RiderService,
            capacity_service_1.CapacityService,
            slot_lock_service_1.SlotLockService,
            hall_service_1.HallService,
            hall_grab_service_1.HallGrabService,
            rider_task_service_1.RiderTaskService,
            rider_credit_service_1.RiderCreditService,
            rider_wallet_service_1.RiderWalletService,
            dispatch_job_service_1.DispatchJobService,
            dispatch_admin_service_1.DispatchAdminService,
            errand_service_1.ErrandService,
            r2_mark_service_1.R2MarkService,
            r4_tag_service_1.R4TagService,
            shipping_profile_ensure_service_1.ShippingProfileEnsureService,
            waimai_store_service_1.WaimaiStoreService,
            merchant_admin_service_1.MerchantAdminService,
            campus_notify_service_1.CampusNotifyService,
            payment_timeout_job_1.PaymentTimeoutJob,
            payment_timeout_admin_service_1.PaymentTimeoutAdminService,
        ],
        adminApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
                type CampusZone {
                    id: ID!
                    name: String!
                    fee: Int!
                    channelId: ID!
                }

                type CampusBuilding {
                    id: ID!
                    name: String!
                    detail: String
                    zoneId: ID!
                    channelId: ID!
                }

                type CampusFulfillmentConfig {
                    id: ID!
                    channelId: ID!
                    routesEnabled: [String!]!
                    riderCommissionRate: Int!
                    autoAssignMinutes: Int!
                    paused: Boolean!
                    autoRefundMinutes: Int!
                    inProgressSlaMinutes: Int!
                    compensationCouponTemplateId: String
                    merchantConfirmEnabled: Boolean!
                    merchantAutoOpenMinutes: Int!
                    freeShippingThreshold: Int
                }

                input CampusFulfillmentConfigInput {
                    routesEnabled: [String!]
                    riderCommissionRate: Int
                    autoAssignMinutes: Int
                    paused: Boolean
                    autoRefundMinutes: Int
                    inProgressSlaMinutes: Int
                    compensationCouponTemplateId: String
                    merchantConfirmEnabled: Boolean
                    merchantAutoOpenMinutes: Int
                }

                type DeliverySlot {
                    id: ID!
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int!
                    lockedCount: Int!
                    active: Boolean!
                    channelId: ID!
                }

                input DeliverySlotInput {
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int
                }

                input DeliverySlotUpdateInput {
                    startTime: String
                    endTime: String
                    capacity: Int
                    active: Boolean
                }

                type CampusSetRiderStatusResult {
                    status: String!
                }

                type MerchantBoardLine {
                    name: String!
                    quantity: Int!
                    price: Int!
                }

                type MerchantBoardOrder {
                    id: ID!
                    code: String!
                    createdAt: DateTime!
                    total: Int!
                    building: String!
                    zone: String!
                    slotText: String!
                    route: String!
                    riderName: String
                    lines: [MerchantBoardLine!]!
                }

                type CampusMerchantBoard {
                    paused: Boolean!
                    merchantConfirmEnabled: Boolean!
                    pending: [MerchantBoardOrder!]!
                    cooking: [MerchantBoardOrder!]!
                    awaitingRider: [MerchantBoardOrder!]!
                    delivering: [MerchantBoardOrder!]!
                    scheduled: [MerchantBoardOrder!]!
                    completedToday: Int!
                    completedTodayAmount: Int!
                }

                type DispatchAlert {
                    orderId: ID!
                    orderCode: String!
                    type: String!
                    detail: String!
                    exceptionNote: String
                    exceptionPhotos: [String!]
                }

                type DispatchRider {
                    customerId: ID!
                    realName: String!
                    credit: Int!
                }

                type HandedException {
                    orderId: ID!
                    orderCode: String!
                    exceptionType: String
                    action: String!
                    compensation: Int
                    couponTemplateId: String
                    note: String
                    handledAt: String
                    handledBy: String!
                }

                type CampusDispatchBoard {
                    paused: Boolean!
                    alerts: [DispatchAlert!]!
                    hallOrders: [Order!]!
                    activeOrders: [Order!]!
                    ridersOnline: [DispatchRider!]!
                    handledOrders: [HandedException!]!
                }

                type CampusDispatchResult {
                    assigned: Boolean
                    backToHall: Boolean
                }
                type CampusHandleExceptionResult {
                    ok: Boolean
                    action: String
                }

                type CampusErrandProductResult {
                    variantId: ID!
                    sku: String!
                }

                type CampusEnsureProfileResult {
                    profileId: ID!
                    profileName: String!
                    linkedMethodCodes: [String!]!
                    missingMethodCodes: [String!]!
                    boundVariantCount: Int!
                }

                type CampusStoreConfigWithChannel {
                    channelId: ID!
                    channelName: String!
                    channelToken: String!
                    routesEnabled: [String!]!
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    errandBaseFee: Int
                    freeShippingThreshold: Int
                    notifyTemplateAccepted: String
                    notifyTemplateRiderAssigned: String
                    notifyTemplateCookingDone: String
                    notifyTemplateDelivered: String
                    notifyTemplateExceptionHandled: String
                    notifyTemplateOrderPlaced: String
                    notifyTemplatePaymentPending: String
                    notifyTemplateCancelled: String
                    notifyTemplateAfterSales: String
                    h5BaseUrl: String
                }

                input CampusStoreConfigInput {
                    routesEnabled: [String!]!
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    errandBaseFee: Int
                    freeShippingThreshold: Int
                    notifyTemplateAccepted: String
                    notifyTemplateRiderAssigned: String
                    notifyTemplateCookingDone: String
                    notifyTemplateDelivered: String
                    notifyTemplateExceptionHandled: String
                    notifyTemplateOrderPlaced: String
                    notifyTemplatePaymentPending: String
                    notifyTemplateCancelled: String
                    notifyTemplateAfterSales: String
                    h5BaseUrl: String
                }

                type RiderWithdrawalRequest {
                    id: ID!
                    customerId: ID!
                    channelId: ID!
                    amount: Int!
                    channel: String!
                    account: String!
                    status: String!
                    remark: String
                    reviewedBy: String
                    reviewedAt: DateTime
                    createdAt: DateTime
                }

                type RiderApplicationList {
                    items: [Customer!]!
                    total: Int!
                }

                extend type Query {
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusConfig: CampusFulfillmentConfig!
                    campusSlots: [DeliverySlot!]!
                    riderApplications(status: String!, skip: Int, take: Int): RiderApplicationList!
                    campusDispatchBoard: CampusDispatchBoard!
                    campusStoreConfigs: [CampusStoreConfigWithChannel!]!
                    campusMerchantBoard: CampusMerchantBoard!
                    riderWithdrawals(status: String, skip: Int, take: Int): [RiderWithdrawalRequest!]!
                }

                extend type Mutation {
                    campusCreateZone(name: String!, fee: Int!): CampusZone!
                    campusCreateBuilding(name: String!, zoneId: ID!, detail: String): CampusBuilding!
                    campusUpdateConfig(input: CampusFulfillmentConfigInput!): CampusFulfillmentConfig!
                    campusCreateSlot(input: DeliverySlotInput!): DeliverySlot!
                    campusUpdateSlot(id: ID!, input: DeliverySlotUpdateInput!): DeliverySlot!
                    campusSetRiderStatus(customerId: ID!, status: String!): CampusSetRiderStatusResult!
                    campusAssignOrder(orderId: ID!, riderCustomerId: ID!): CampusDispatchResult!
                    campusBackToHall(orderId: ID!): CampusDispatchResult!
                    campusHandleException(orderId: ID!, action: String!, amount: Int, couponTemplateId: ID, note: String): CampusHandleExceptionResult!
                    campusEnsureErrandProducts: CampusErrandProductResult!
                    campusUpdateStoreConfig(channelId: ID!, input: CampusStoreConfigInput!): CampusStoreConfigWithChannel!
                    campusEnsureDefaultShippingProfile(channelId: ID!): CampusEnsureProfileResult!
                    campusMerchantAcceptOrder(orderId: ID!): CampusMerchantOpResult!
                    campusMerchantCookingDone(orderId: ID!): CampusMerchantOpResult!
                    campusMerchantSetPaused(paused: Boolean!): CampusMerchantOpResult!
                    approveRiderWithdraw(id: ID!, remark: String): RiderWithdrawalRequest!
                    rejectRiderWithdraw(id: ID!, remark: String): RiderWithdrawalRequest!
                }

                type CampusMerchantOpResult {
                    ok: Boolean!
                }

                type PaymentTimeoutTask {
                    id: ID!
                    orderId: ID!
                    type: String!
                    status: String!
                    dueAt: DateTime!
                    retryCount: Int!
                    lastError: String
                }

                type PaymentTimeoutTaskRow {
                    id: ID!
                    orderId: ID!
                    channelId: ID!
                    orderCode: String
                    orderState: String
                    type: String!
                    status: String!
                    dueAt: DateTime!
                    retryCount: Int!
                    lastError: String
                }

                type PaymentTimeoutTaskList {
                    items: [PaymentTimeoutTaskRow!]!
                    total: Int!
                }

                type PaymentTimeoutStats {
                    todayRemind: Int!
                    todayCancel: Int!
                    totalFailed: Int!
                    pendingOverdue: Int!
                }

                extend type Query {
                    paymentTimeoutTasks(status: String, type: String, from: DateTime, to: DateTime, skip: Int, take: Int): PaymentTimeoutTaskList!
                    paymentTimeoutStats: PaymentTimeoutStats!
                }

                extend type Mutation {
                    executePaymentTimeoutTask(id: ID!): PaymentTimeoutTask!
                    resendPaymentTimeoutRemind(taskId: ID!): Boolean!
                    runPaymentTimeoutCompensation: Int!
                }
            `;
            },
            resolvers: [campus_config_admin_resolver_1.CampusConfigAdminResolver, rider_admin_resolver_1.RiderAdminResolver, dispatch_admin_resolver_1.DispatchAdminResolver, merchant_admin_resolver_1.MerchantAdminResolver, payment_timeout_admin_resolver_1.PaymentTimeoutAdminResolver],
        },
        shopApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                // shop 与 admin 是两个独立 schema，输出类型需各自定义
                return gql `
                type CampusZone {
                    id: ID!
                    name: String!
                    fee: Int!
                    channelId: ID!
                }

                type CampusBuilding {
                    id: ID!
                    name: String!
                    detail: String
                    zoneId: ID!
                    channelId: ID!
                }

                type RiderProfile {
                    customerId: ID!
                    riderStatus: String
                    riderRealName: String
                    riderStudentNo: String
                    riderCampus: String
                    riderCredit: Int
                }

                type RiderApplyResult {
                    status: String!
                }

                type DeliverySlot {
                    id: ID!
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int!
                    lockedCount: Int!
                    active: Boolean!
                    channelId: ID!
                }

                type RiderEarning {
                    id: ID!
                    orderId: ID!
                    riderCustomerId: ID!
                    amount: Int!
                    tip: Int!
                    status: String!
                    createdAt: DateTime
                    channelId: ID!
                }

                type CampusRiderOnlineResult {
                    online: Boolean!
                }

                type CampusCapacityCheck {
                    paused: Boolean!
                    ridersOnline: Int!
                }

                type CampusRejectResult {
                    backToHall: Boolean!
                }

                input CampusErrandInput {
                    kind: String!
                    fromText: String!
                    toText: String!
                    tip: Int!
                    buildingId: ID
                    campusZone: String
                    errandFrom: String
                    note: String
                }

                type CampusErrandInfoResult {
                    orderId: ID!
                }

                type CampusErrandVariantResult {
                    variantId: ID!
                    sku: String!
                    errandBaseFee: Int!
                }

                type CampusArrivedResult {
                    leg1Status: String!
                }

                type WaimaiStore {
                    channelId: ID!
                    channelToken: String!
                    name: String!
                    logo: String
                    tags: [String!]!
                    monthlySales: Int!
                    promoText: String
                    paused: Boolean!
                    routesEnabled: [String!]!
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    errandBaseFee: Int
                    freeShippingThreshold: Int
                }

                type CampusOrderRider {
                    realName: String!
                    credit: Int!
                    location: CampusRiderLocation
                }

                type CampusRiderLocation {
                    lat: Float!
                    lng: Float!
                }

                type CampusR2Relay {
                    orderId: ID!
                    orderCode: String!
                    state: String!
                    hallStatus: String
                    deliveryStatus: String
                    errandTo: String
                    tip: Int!
                    totalWithTax: Int!
                }

                type RiderWallet {
                    available: Int!
                    frozen: Int!
                    totalEarned: Int!
                }

                type RiderWithdrawalRequest {
                    id: ID!
                    customerId: ID!
                    channelId: ID!
                    amount: Int!
                    channel: String!
                    account: String!
                    status: String!
                    remark: String
                    reviewedBy: String
                    reviewedAt: DateTime
                    createdAt: DateTime
                }

                type RiderBalanceTx {
                    id: ID!
                    createdAt: DateTime
                    type: String!
                    amount: Int!
                    balanceAfter: Int!
                    remark: String
                }

                type CampusHallOrderCustomFields {
                    hallStatus: String
                    hallEnteredAt: DateTime
                    tip: Int
                    fulfillmentRoute: String
                    campusZone: String
                    buildingId: String
                    deliverySlotText: String
                    routeGroupId: String
                }

                type CampusHallOrder {
                    id: ID!
                    code: String!
                    total: Int!
                    shipping: Int!
                    createdAt: DateTime!
                    channelId: ID!
                    channelToken: String!
                    channelName: String!
                    customFields: CampusHallOrderCustomFields
                }

                extend type Query {
                    myRiderProfile: RiderProfile!
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusHall: [Order!]!
                    campusHallAll: [CampusHallOrder!]!
                    campusMyTasks(status: String): [Order!]!
                    campusShopSlots: [DeliverySlot!]!
                    myRiderEarnings(skip: Int, take: Int): [RiderEarning!]!
                    campusCapacityCheck: CampusCapacityCheck!
                    waimaiStoreList: [WaimaiStore!]!
                    campusOrderRider(orderId: ID!): CampusOrderRider
                    campusR2Relay(orderId: ID!): CampusR2Relay
                    campusErrandVariant: CampusErrandVariantResult!
                    myRiderWallet: RiderWallet!
                    riderBalanceHistory(skip: Int, take: Int): [RiderBalanceTx!]!
                    riderWithdrawRequests(skip: Int, take: Int): [RiderWithdrawalRequest!]!
                }

                extend type Mutation {
                    applyRider(realName: String!, studentNo: String!, campus: String!, idImg: String): RiderApplyResult!
                    campusGrabOrder(orderId: ID!): Order!
                    campusStartTask(orderId: ID!): Order!
                    campusTransferTask(orderId: ID!, photos: [String!]!, note: String): Order!
                    campusDeliverTask(orderId: ID!, photos: [String!]!, note: String): Order!
                    campusRiderReportLocation(orderId: ID!, lat: Float!, lng: Float!): Order!
                    campusUrgeOrder(orderId: ID!): Order!
                    campusReportException(orderId: ID!, type: String!, photos: [String!]!, note: String): Order!
                    campusSetDeliveryTarget(zoneId: ID!, buildingId: ID!, route: String, slotId: Int): Order!
                    applyOrderInvoice(orderId: ID!, invoiceInfo: String!): Boolean!
                    campusRejectAssignment(orderId: ID!): CampusRejectResult!
                    campusRiderOnline(online: Boolean!): CampusRiderOnlineResult!
                    campusRiderHeartbeat: CampusRiderOnlineResult!
                    campusSetErrandInfo(input: CampusErrandInput!): CampusErrandInfoResult!
                    campusMarkArrived(orderId: ID!): CampusArrivedResult!
                    riderWithdraw(amount: Int!, channel: String!, account: String!): RiderWithdrawalRequest!
                }
            `;
            },
            resolvers: [rider_shop_resolver_1.RiderShopResolver, hall_shop_resolver_1.HallShopResolver, rider_task_shop_resolver_1.RiderTaskShopResolver, errand_shop_resolver_1.ErrandShopResolver, waimai_shop_resolver_1.WaimaiShopResolver, r2_shop_resolver_1.R2ShopResolver, campus_invoice_resolver_1.InvoiceShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...permissions_1.campusPermissionDefinitions,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [...((_b = config.customFields.Order) !== null && _b !== void 0 ? _b : []), ...((_c = custom_fields_1.campusCustomFields.Order) !== null && _c !== void 0 ? _c : [])], Customer: [...((_d = config.customFields.Customer) !== null && _d !== void 0 ? _d : []), ...((_e = custom_fields_1.campusCustomFields.Customer) !== null && _e !== void 0 ? _e : [])], Channel: [...((_f = config.customFields.Channel) !== null && _f !== void 0 ? _f : []), ...((_g = custom_fields_1.campusCustomFields.Channel) !== null && _g !== void 0 ? _g : [])], Address: [...((_h = config.customFields.Address) !== null && _h !== void 0 ? _h : []), ...((_j = custom_fields_1.campusCustomFields.Address) !== null && _j !== void 0 ? _j : [])] });
            config.shippingOptions.shippingCalculators = [
                ...((_k = config.shippingOptions.shippingCalculators) !== null && _k !== void 0 ? _k : []),
                shipping_calculator_1.campusErrandCalculator,
            ];
            // 起送价硬校验（二期 §3.2）：ArrangingPayment 过渡拦截，跑腿单豁免
            config.orderOptions = Object.assign(Object.assign({}, ((_l = config.orderOptions) !== null && _l !== void 0 ? _l : {})), { process: [...((_o = (_m = config.orderOptions) === null || _m === void 0 ? void 0 : _m.process) !== null && _o !== void 0 ? _o : []), min_order_process_1.campusMinOrderProcess] });
            // 跑腿单 ShippingLine 分配：包装既有策略（cjk Box 按配送档案分箱，跑腿 0 元载体无档案
            // 绑定会被返回空数组 → 孤儿线）。本插件在 dev-config 中位于 CjkPlugin 之后，
            // configuration 钩子后执行，此处拿到的即为 cjk 已设置的策略，包装后原行为不变。
            const prevAssignmentStrategy = config.shippingOptions.shippingLineAssignmentStrategy;
            if (prevAssignmentStrategy) {
                config.shippingOptions.shippingLineAssignmentStrategy =
                    new errand_shipping_line_assignment_1.CampusErrandShippingLineAssignmentStrategy(prevAssignmentStrategy);
            }
            // 待付款补偿任务幂等注册
            config.schedulerOptions.tasks = (_p = config.schedulerOptions.tasks) !== null && _p !== void 0 ? _p : [];
            if (!config.schedulerOptions.tasks.some(t => t.id === PAYMENT_TIMEOUT_COMPENSATION)) {
                config.schedulerOptions.tasks.push(paymentTimeoutCompensation);
            }
            return config;
        },
        compatibility: '^3.6.4',
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        hall_service_1.HallService,
        r4_tag_service_1.R4TagService,
        core_2.ModuleRef,
        campus_notify_service_1.CampusNotifyService,
        payment_timeout_job_1.PaymentTimeoutJob,
        campus_config_service_1.CampusConfigService])
], CampusDeliveryPlugin);
//# sourceMappingURL=campus-delivery.plugin.js.map