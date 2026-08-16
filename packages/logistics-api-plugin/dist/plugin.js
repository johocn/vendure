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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LogisticsApiPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsApiPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const channel_custom_fields_1 = require("./channel-custom-fields");
const logistics_api_admin_resolver_1 = require("./logistics-api-admin.resolver");
const logistics_query_service_1 = require("./logistics-query.service");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
let LogisticsApiPlugin = LogisticsApiPlugin_1 = class LogisticsApiPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        LogisticsApiPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return LogisticsApiPlugin_1;
    }
};
exports.LogisticsApiPlugin = LogisticsApiPlugin;
LogisticsApiPlugin.options = {};
exports.LogisticsApiPlugin = LogisticsApiPlugin = LogisticsApiPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.LOGISTICS_API_PLUGIN_OPTIONS, useFactory: () => LogisticsApiPlugin.options },
            logistics_query_service_1.LogisticsQueryService,
        ],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            type TrackingTrace {
                time: String!
                status: String!
                description: String!
            }

            type TrackingResult {
                carrierCode: String!
                trackingNumber: String!
                traces: [TrackingTrace!]!
            }

            type CarrierDetectResult {
                code: String!
                name: String!
            }

            extend type Query {
                logisticsTracking(carrierCode: String!, trackingNumber: String!): TrackingResult!
                detectCarrier(trackingNumber: String!): [CarrierDetectResult!]!
            }
        `,
            resolvers: [logistics_api_admin_resolver_1.LogisticsApiAdminResolver],
        },
        configuration: (config) => {
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.logisticsApiChannelCustomFields.Channel);
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.LOGISTICS_API_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], LogisticsApiPlugin);
