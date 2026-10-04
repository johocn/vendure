"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusDeliveryPlugin = void 0;
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_config_admin_resolver_1 = require("./campus-config-admin.resolver");
const campus_config_service_1 = require("./campus-config.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const custom_fields_1 = require("./custom-fields");
const create_campus_tables_1 = require("./migrations/create-campus-tables");
const permissions_1 = require("./permissions");
const rider_earning_entity_1 = require("./rider-earning.entity");
let CampusDeliveryPlugin = class CampusDeliveryPlugin {
};
exports.CampusDeliveryPlugin = CampusDeliveryPlugin;
exports.CampusDeliveryPlugin = CampusDeliveryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [campus_zone_entity_1.CampusZone, campus_building_entity_1.CampusBuilding, rider_earning_entity_1.RiderEarning, campus_fulfillment_config_entity_1.CampusFulfillmentConfig],
        providers: [create_campus_tables_1.CreateCampusTablesMigration, campus_config_service_1.CampusConfigService],
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
                }

                input CampusFulfillmentConfigInput {
                    routesEnabled: [String!]
                    riderCommissionRate: Int
                    autoAssignMinutes: Int
                    paused: Boolean
                }

                extend type Query {
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusConfig: CampusFulfillmentConfig!
                }

                extend type Mutation {
                    campusCreateZone(name: String!, fee: Int!): CampusZone!
                    campusCreateBuilding(name: String!, zoneId: ID!, detail: String): CampusBuilding!
                    campusUpdateConfig(input: CampusFulfillmentConfigInput!): CampusFulfillmentConfig!
                }
            `;
            },
            resolvers: [campus_config_admin_resolver_1.CampusConfigAdminResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...permissions_1.campusPermissionDefinitions,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [...((_b = config.customFields.Order) !== null && _b !== void 0 ? _b : []), ...((_c = custom_fields_1.campusCustomFields.Order) !== null && _c !== void 0 ? _c : [])], Customer: [...((_d = config.customFields.Customer) !== null && _d !== void 0 ? _d : []), ...((_e = custom_fields_1.campusCustomFields.Customer) !== null && _e !== void 0 ? _e : [])] });
            return config;
        },
        compatibility: '^3.6.4',
    })
], CampusDeliveryPlugin);
//# sourceMappingURL=campus-delivery.plugin.js.map