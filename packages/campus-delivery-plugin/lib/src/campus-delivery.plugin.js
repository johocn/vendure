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
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const hall_shop_resolver_1 = require("./hall-shop.resolver");
const create_campus_tables_1 = require("./migrations/create-campus-tables");
const permissions_1 = require("./permissions");
const rider_admin_resolver_1 = require("./rider-admin.resolver");
const rider_credit_log_entity_1 = require("./rider-credit-log.entity");
const rider_credit_service_1 = require("./rider-credit.service");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_service_1 = require("./rider.service");
const rider_shop_resolver_1 = require("./rider-shop.resolver");
const rider_task_service_1 = require("./rider-task.service");
const rider_task_shop_resolver_1 = require("./rider-task-shop.resolver");
const shipping_calculator_1 = require("./shipping-calculator");
const slot_lock_service_1 = require("./slot-lock.service");
let CampusDeliveryPlugin = class CampusDeliveryPlugin {
    constructor(eventBus, hallService, injector) {
        this.eventBus = eventBus;
        this.hallService = hallService;
        this.injector = injector;
    }
    onApplicationBootstrap() {
        (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)(this.injector.get(core_1.TransactionalConnection));
        this.eventBus.ofType(core_1.OrderPlacedEvent).subscribe(({ ctx, order }) => this.hallService.onOrderPlaced(ctx, order).catch(e => core_1.Logger.error(String(e), 'CampusHall')));
        this.injector.get(dispatch_job_service_1.DispatchJobService).start();
    }
};
exports.CampusDeliveryPlugin = CampusDeliveryPlugin;
exports.CampusDeliveryPlugin = CampusDeliveryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [campus_zone_entity_1.CampusZone, campus_building_entity_1.CampusBuilding, rider_earning_entity_1.RiderEarning, campus_fulfillment_config_entity_1.CampusFulfillmentConfig, delivery_slot_entity_1.DeliverySlot, rider_credit_log_entity_1.RiderCreditLog],
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
            dispatch_job_service_1.DispatchJobService,
            dispatch_admin_service_1.DispatchAdminService,
            errand_service_1.ErrandService,
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
                }

                input CampusFulfillmentConfigInput {
                    routesEnabled: [String!]
                    riderCommissionRate: Int
                    autoAssignMinutes: Int
                    paused: Boolean
                    autoRefundMinutes: Int
                    inProgressSlaMinutes: Int
                    compensationCouponTemplateId: String
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

                type DispatchAlert {
                    orderId: ID!
                    orderCode: String!
                    type: String!
                    detail: String!
                }

                type DispatchRider {
                    customerId: ID!
                    realName: String!
                    credit: Int!
                }

                type CampusDispatchBoard {
                    paused: Boolean!
                    alerts: [DispatchAlert!]!
                    hallOrders: [Order!]!
                    activeOrders: [Order!]!
                    ridersOnline: [DispatchRider!]!
                }

                type CampusDispatchResult {
                    assigned: Boolean
                    backToHall: Boolean
                }

                type CampusErrandProductResult {
                    variantId: ID!
                    sku: String!
                }

                extend type Query {
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusConfig: CampusFulfillmentConfig!
                    campusSlots: [DeliverySlot!]!
                    riderApplications(status: String!): [Customer!]!
                    campusDispatchBoard: CampusDispatchBoard!
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
                    campusEnsureErrandProducts: CampusErrandProductResult!
                }
            `;
            },
            resolvers: [campus_config_admin_resolver_1.CampusConfigAdminResolver, rider_admin_resolver_1.RiderAdminResolver, dispatch_admin_resolver_1.DispatchAdminResolver],
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
                }

                type CampusErrandInfoResult {
                    orderId: ID!
                }

                extend type Query {
                    myRiderProfile: RiderProfile!
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusHall: [Order!]!
                    campusMyTasks(status: String): [Order!]!
                    campusShopSlots: [DeliverySlot!]!
                    myRiderEarnings(skip: Int, take: Int): [RiderEarning!]!
                    campusCapacityCheck: CampusCapacityCheck!
                }

                extend type Mutation {
                    applyRider(realName: String!, studentNo: String!, campus: String!, idImg: String): RiderApplyResult!
                    campusGrabOrder(orderId: ID!): Order!
                    campusStartTask(orderId: ID!): Order!
                    campusDeliverTask(orderId: ID!, photos: [String!]!, note: String): Order!
                    campusReportException(orderId: ID!, type: String!, photos: [String!]!, note: String): Order!
                    campusSetDeliveryTarget(zoneId: ID!, buildingId: ID!): Order!
                    campusRejectAssignment(orderId: ID!): CampusRejectResult!
                    campusRiderOnline(online: Boolean!): CampusRiderOnlineResult!
                    campusRiderHeartbeat: CampusRiderOnlineResult!
                    campusSetErrandInfo(input: CampusErrandInput!): CampusErrandInfoResult!
                }
            `;
            },
            resolvers: [rider_shop_resolver_1.RiderShopResolver, hall_shop_resolver_1.HallShopResolver, rider_task_shop_resolver_1.RiderTaskShopResolver, errand_shop_resolver_1.ErrandShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e, _f;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...permissions_1.campusPermissionDefinitions,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [...((_b = config.customFields.Order) !== null && _b !== void 0 ? _b : []), ...((_c = custom_fields_1.campusCustomFields.Order) !== null && _c !== void 0 ? _c : [])], Customer: [...((_d = config.customFields.Customer) !== null && _d !== void 0 ? _d : []), ...((_e = custom_fields_1.campusCustomFields.Customer) !== null && _e !== void 0 ? _e : [])] });
            config.shippingOptions.shippingCalculators = [
                ...((_f = config.shippingOptions.shippingCalculators) !== null && _f !== void 0 ? _f : []),
                shipping_calculator_1.campusErrandCalculator,
            ];
            return config;
        },
        compatibility: '^3.6.4',
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        hall_service_1.HallService,
        core_1.Injector])
], CampusDeliveryPlugin);
//# sourceMappingURL=campus-delivery.plugin.js.map