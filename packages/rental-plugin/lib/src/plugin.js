"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RentalPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentalPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const rental_plan_entity_1 = require("./rental-plan.entity");
const rental_admin_resolver_1 = require("./rental-admin.resolver");
const rental_service_1 = require("./rental.service");
let RentalPlugin = RentalPlugin_1 = class RentalPlugin {
    static init(options) {
        RentalPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return RentalPlugin_1;
    }
};
exports.RentalPlugin = RentalPlugin;
RentalPlugin.options = {};
exports.RentalPlugin = RentalPlugin = RentalPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [rental_plan_entity_1.RentalPlan],
        providers: [
            { provide: constants_1.RENTAL_PLUGIN_OPTIONS, useFactory: () => RentalPlugin.options },
            rental_service_1.RentalService,
        ],
        exports: [rental_service_1.RentalService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            type RentalPlan implements Node {
                id: ID!
                name: String!
                variantId: ID!
                depositAmount: Int!
                rentAmount: Int!
                rentUnit: String!
                prepaidOrPostpaid: String!
                buyoutPrice: Int
                allowBuyout: Boolean!
                allowCod: Boolean!
                enabled: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type RentalPlanList implements PaginatedList {
                items: [RentalPlan!]!
                totalItems: Int!
            }

            input CreateRentalPlanInput {
                name: String!
                variantId: ID!
                depositAmount: Int!
                rentAmount: Int!
                rentUnit: String
                prepaidOrPostpaid: String
                buyoutPrice: Int
                allowBuyout: Boolean
                allowCod: Boolean
                enabled: Boolean
            }

            input UpdateRentalPlanInput {
                id: ID!
                name: String
                depositAmount: Int
                rentAmount: Int
                rentUnit: String
                prepaidOrPostpaid: String
                buyoutPrice: Int
                allowBuyout: Boolean
                allowCod: Boolean
                enabled: Boolean
            }

            input RentalPlanListOptions

            extend type Query {
                rentalPlans(options: RentalPlanListOptions): RentalPlanList!
                rentalPlan(id: ID!): RentalPlan
            }

            extend type Mutation {
                createRentalPlan(input: CreateRentalPlanInput!): RentalPlan!
                updateRentalPlan(input: UpdateRentalPlanInput!): RentalPlan!
                deleteRentalPlan(id: ID!): Boolean!
            }
        `,
            resolvers: [rental_admin_resolver_1.RentalAdminResolver],
        },
        compatibility: '^3.0.0',
    })
], RentalPlugin);
