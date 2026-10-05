import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Logger, OrderPlacedEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CapacityService } from './capacity.service';
import { CampusConfigAdminResolver } from './campus-config-admin.resolver';
import { CampusConfigService } from './campus-config.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { campusCustomFields } from './custom-fields';
import { DeliverySlot } from './delivery-slot.entity';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { HallShopResolver } from './hall-shop.resolver';
import { CreateCampusTablesMigration } from './migrations/create-campus-tables';
import { campusPermissionDefinitions } from './permissions';
import { RiderAdminResolver } from './rider-admin.resolver';
import { RiderCreditLog } from './rider-credit-log.entity';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';
import { RiderShopResolver } from './rider-shop.resolver';
import { RiderTaskService } from './rider-task.service';
import { RiderTaskShopResolver } from './rider-task-shop.resolver';
import { SlotLockService } from './slot-lock.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CampusZone, CampusBuilding, RiderEarning, CampusFulfillmentConfig, DeliverySlot, RiderCreditLog],
    providers: [
        CreateCampusTablesMigration,
        CampusConfigService,
        RiderService,
        CapacityService,
        SlotLockService,
        HallService,
        HallGrabService,
        RiderTaskService,
    ],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
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

                extend type Query {
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusConfig: CampusFulfillmentConfig!
                    campusSlots: [DeliverySlot!]!
                    riderApplications(status: String!): [Customer!]!
                }

                extend type Mutation {
                    campusCreateZone(name: String!, fee: Int!): CampusZone!
                    campusCreateBuilding(name: String!, zoneId: ID!, detail: String): CampusBuilding!
                    campusUpdateConfig(input: CampusFulfillmentConfigInput!): CampusFulfillmentConfig!
                    campusCreateSlot(input: DeliverySlotInput!): DeliverySlot!
                    campusUpdateSlot(id: ID!, input: DeliverySlotUpdateInput!): DeliverySlot!
                    campusSetRiderStatus(customerId: ID!, status: String!): CampusSetRiderStatusResult!
                }
            `;
        },
        resolvers: [CampusConfigAdminResolver, RiderAdminResolver],
    },
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            // shop 与 admin 是两个独立 schema，输出类型需各自定义
            return gql`
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
                    campusRiderOnline(online: Boolean!): CampusRiderOnlineResult!
                    campusRiderHeartbeat: CampusRiderOnlineResult!
                }
            `;
        },
        resolvers: [RiderShopResolver, HallShopResolver, RiderTaskShopResolver],
    },
    configuration: config => {
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...campusPermissionDefinitions,
        ];
        config.customFields = {
            ...config.customFields,
            Order: [...(config.customFields.Order ?? []), ...(campusCustomFields.Order ?? [])],
            Customer: [...(config.customFields.Customer ?? []), ...(campusCustomFields.Customer ?? [])],
        };
        return config;
    },
    compatibility: '^3.6.4',
})
export class CampusDeliveryPlugin implements OnApplicationBootstrap {
    constructor(private eventBus: EventBus, private hallService: HallService) {}

    onApplicationBootstrap(): void {
        this.eventBus.ofType(OrderPlacedEvent).subscribe(({ ctx, order }) =>
            this.hallService.onOrderPlaced(ctx, order).catch(e => Logger.error(String(e), 'CampusHall')),
        );
    }
}
