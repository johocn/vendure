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
var LogisticsPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const fulfillment_custom_fields_1 = require("./fulfillment-custom-fields");
const channel_custom_fields_1 = require("./channel-custom-fields");
const channel_stock_allocation_strategy_1 = require("./channel-stock-allocation-strategy");
let LogisticsPlugin = LogisticsPlugin_1 = class LogisticsPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        LogisticsPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return LogisticsPlugin_1;
    }
};
exports.LogisticsPlugin = LogisticsPlugin;
LogisticsPlugin.options = {};
exports.LogisticsPlugin = LogisticsPlugin = LogisticsPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
        ],
        configuration: (config) => {
            var _a, _b;
            config.customFields.Fulfillment = [
                ...((_a = config.customFields.Fulfillment) !== null && _a !== void 0 ? _a : []),
                ...fulfillment_custom_fields_1.logisticsFulfillmentCustomFields.Fulfillment,
            ];
            config.customFields.Channel = [
                ...((_b = config.customFields.Channel) !== null && _b !== void 0 ? _b : []),
                ...channel_custom_fields_1.logisticsChannelCustomFields.Channel,
            ];
            config.orderOptions.stockAllocationStrategy = new channel_stock_allocation_strategy_1.ChannelStockAllocationStrategy();
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.LOGISTICS_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], LogisticsPlugin);
//# sourceMappingURL=plugin.js.map