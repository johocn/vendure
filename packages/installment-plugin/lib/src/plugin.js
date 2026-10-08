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
var InstallmentPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallmentPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const installment_plan_entity_1 = require("./installment-plan.entity");
const installment_admin_resolver_1 = require("./installment-admin.resolver");
const installment_service_1 = require("./installment.service");
let InstallmentPlugin = InstallmentPlugin_1 = class InstallmentPlugin {
    static init(options) {
        InstallmentPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return InstallmentPlugin_1;
    }
};
exports.InstallmentPlugin = InstallmentPlugin;
InstallmentPlugin.options = {};
exports.InstallmentPlugin = InstallmentPlugin = InstallmentPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [installment_plan_entity_1.InstallmentPlan],
        providers: [
            { provide: constants_1.INSTALLMENT_PLUGIN_OPTIONS, useFactory: () => InstallmentPlugin.options },
            installment_service_1.InstallmentService,
        ],
        exports: [installment_service_1.InstallmentService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            type InstallmentPlan implements Node {
                id: ID!
                name: String!
                variantId: ID!
                downPaymentRatio: Int!
                periods: Int!
                intervalUnit: String!
                intervalCount: Int!
                feeRule: JSON
                allowCod: Boolean!
                enabled: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type InstallmentPlanList implements PaginatedList {
                items: [InstallmentPlan!]!
                totalItems: Int!
            }

            input CreateInstallmentPlanInput {
                name: String!
                variantId: ID!
                downPaymentRatio: Int
                periods: Int
                intervalUnit: String
                intervalCount: Int
                feeRule: JSON
                allowCod: Boolean
                enabled: Boolean
            }

            input UpdateInstallmentPlanInput {
                id: ID!
                name: String
                downPaymentRatio: Int
                periods: Int
                intervalUnit: String
                intervalCount: Int
                feeRule: JSON
                allowCod: Boolean
                enabled: Boolean
            }

            input InstallmentPlanListOptions

            extend type Query {
                installmentPlans(options: InstallmentPlanListOptions): InstallmentPlanList!
                installmentPlan(id: ID!): InstallmentPlan
            }

            extend type Mutation {
                createInstallmentPlan(input: CreateInstallmentPlanInput!): InstallmentPlan!
                updateInstallmentPlan(input: UpdateInstallmentPlanInput!): InstallmentPlan!
                deleteInstallmentPlan(id: ID!): Boolean!
            }
        `,
            resolvers: [installment_admin_resolver_1.InstallmentAdminResolver],
        },
        compatibility: '^3.0.0',
    })
], InstallmentPlugin);
