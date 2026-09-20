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
var EcoPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcoPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const eco_controller_1 = require("./eco.controller");
const eco_events_listener_1 = require("./eco-events.listener");
const eco_reporter_service_1 = require("./eco-reporter.service");
/**
 * 生态行为回调钩子（E5b）：
 * - purchase：监听 OrderPlacedEvent，上报下单用户的 SSO ID（targetId=订单 code）
 * - distribute：监听 distribution-plugin 的 CommissionRecordCreatedEvent，上报 inviter 的 SSO ID
 * - view_product / view_price：POST /eco/events 转发端点（供 nshop 前端调用）
 * 签名密钥/游戏地址走插件 config 或环境变量 GAME_ECO_URL / GAME_ECO_SECRET；
 * 上报为 fire-and-forget + 2s 超时 + 失败静默，绝不影响订单/佣金主流程。
 */
let EcoPlugin = EcoPlugin_1 = class EcoPlugin {
    constructor(options, listener) {
        this.options = options;
        this.listener = listener;
    }
    static init(options) {
        EcoPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return EcoPlugin_1;
    }
    async onApplicationBootstrap() {
        this.listener.init();
        const configured = !!(EcoPlugin_1.options.gameUrl || process.env.GAME_ECO_URL) &&
            !!(EcoPlugin_1.options.secret || process.env.GAME_ECO_SECRET);
        core_1.Logger.info(configured
            ? 'EcoPlugin initialized'
            : 'EcoPlugin initialized（未配置 GAME_ECO_URL/GAME_ECO_SECRET，上报将静默跳过）', constants_1.loggerCtx);
    }
};
exports.EcoPlugin = EcoPlugin;
EcoPlugin.options = {};
exports.EcoPlugin = EcoPlugin = EcoPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [eco_controller_1.EcoController],
        providers: [
            { provide: constants_1.ECO_PLUGIN_OPTIONS, useFactory: () => EcoPlugin.options },
            eco_reporter_service_1.EcoReporter,
            eco_events_listener_1.EcoEventsListener,
        ],
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.ECO_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, eco_events_listener_1.EcoEventsListener])
], EcoPlugin);
//# sourceMappingURL=plugin.js.map