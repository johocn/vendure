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
var RedisStockPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStockPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const channel_custom_fields_1 = require("./channel-custom-fields");
const stock_prewarm_service_1 = require("./stock-prewarm.service");
const stock_reserve_service_1 = require("./stock-reserve.service");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
let RedisStockPlugin = RedisStockPlugin_1 = class RedisStockPlugin {
    constructor(options, stockReserveService) {
        this.options = options;
        this.stockReserveService = stockReserveService;
    }
    static init(options) {
        RedisStockPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return RedisStockPlugin_1;
    }
    async onApplicationBootstrap() {
        await this.stockReserveService.init(this.options);
        core_1.Logger.info('RedisStockPlugin initialized', constants_1.loggerCtx);
    }
};
exports.RedisStockPlugin = RedisStockPlugin;
RedisStockPlugin.options = {};
exports.RedisStockPlugin = RedisStockPlugin = RedisStockPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.REDIS_STOCK_PLUGIN_OPTIONS, useFactory: () => RedisStockPlugin.options },
            stock_reserve_service_1.StockReserveService,
            stock_prewarm_service_1.StockPrewarmService,
        ],
        configuration: (config) => {
            config.customFields.Channel = mergeCustomFields(config.customFields.Channel, channel_custom_fields_1.redisStockChannelCustomFields.Channel);
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.REDIS_STOCK_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, stock_reserve_service_1.StockReserveService])
], RedisStockPlugin);
