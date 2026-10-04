import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusConfigAdminResolver } from './campus-config-admin.resolver';
import { CampusConfigService } from './campus-config.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { campusCustomFields } from './custom-fields';
import { CreateCampusTablesMigration } from './migrations/create-campus-tables';
import { campusPermissionDefinitions } from './permissions';
import { RiderEarning } from './rider-earning.entity';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CampusZone, CampusBuilding, RiderEarning, CampusFulfillmentConfig],
    providers: [CreateCampusTablesMigration, CampusConfigService],
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
        resolvers: [CampusConfigAdminResolver],
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
export class CampusDeliveryPlugin {}
