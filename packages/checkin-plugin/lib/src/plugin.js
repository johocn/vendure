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
var CheckinPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckinPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const channel_custom_fields_1 = require("./channel-custom-fields");
const checkin_record_entity_1 = require("./checkin-record.entity");
const task_record_entity_1 = require("./task-record.entity");
const checkin_service_1 = require("./checkin.service");
const checkin_shop_resolver_1 = require("./checkin-shop.resolver");
const constants_1 = require("./constants");
const { gql } = require('graphql-tag');
function mergeCustomFields(existing, additions) {
    const names = new Set((existing !== null && existing !== void 0 ? existing : []).map(f => f.name));
    return [...(existing !== null && existing !== void 0 ? existing : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const shopSchema = () => gql `
    type CheckinResult {
        success: Boolean!
        reason: String
        points: Int
        growth: Int
        streak: Int
    }
    type CheckinTodayInfo {
        checkedIn: Boolean!
        streak: Int!
        canCheckin: Boolean!
    }
    type TaskSummary {
        taskCode: String!
        state: String!
        points: Int!
        growth: Int!
    }
    extend type Query {
        checkinToday: CheckinTodayInfo!
        myTasks: [TaskSummary!]!
    }
    extend type Mutation {
        checkin: CheckinResult!
        claimTask(taskCode: String!): CheckinResult!
    }
`;
let CheckinPlugin = CheckinPlugin_1 = class CheckinPlugin {
    constructor(options, checkinService, eventBus, configService) {
        this.options = options;
        this.checkinService = checkinService;
        this.eventBus = eventBus;
        this.configService = configService;
    }
    static init(options) {
        CheckinPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return CheckinPlugin_1;
    }
    async onApplicationBootstrap() {
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe((event) => {
            if (event.toState === 'Delivered' && event.order.customer) {
                const shippingMethodContext = event.ctx;
                void this.checkinService
                    .awardMilestones(shippingMethodContext, event.order.customer.id)
                    .catch((e) => { var _a; return core_1.Logger.error(`checkin milestone award failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx); });
            }
        });
        core_1.Logger.info('CheckinPlugin initialized', constants_1.loggerCtx);
    }
};
exports.CheckinPlugin = CheckinPlugin;
CheckinPlugin.options = {};
exports.CheckinPlugin = CheckinPlugin = CheckinPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [checkin_record_entity_1.CheckinRecord, task_record_entity_1.TaskRecord],
        providers: [
            { provide: constants_1.CHECKIN_PLUGIN_OPTIONS, useFactory: () => CheckinPlugin.options },
            checkin_service_1.CheckinService,
        ],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [checkin_shop_resolver_1.CheckinShopResolver],
        },
        configuration: (config) => {
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.checkinChannelCustomFields.Channel);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.CHECKIN_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, checkin_service_1.CheckinService,
        core_1.EventBus,
        core_1.ConfigService])
], CheckinPlugin);
//# sourceMappingURL=plugin.js.map