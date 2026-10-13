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
var MeiliSearchPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeiliSearchPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const meili_service_1 = require("./meili.service");
let MeiliSearchPlugin = MeiliSearchPlugin_1 = class MeiliSearchPlugin {
    constructor(options, meiliService) {
        this.options = options;
        this.meiliService = meiliService;
    }
    static init(options) {
        MeiliSearchPlugin_1.options = options;
        return MeiliSearchPlugin_1;
    }
    async onApplicationBootstrap() {
        try {
            await this.meiliService.ensureIndexes();
            core_1.Logger.info('MeiliSearchPlugin initialized', constants_1.loggerCtx);
        }
        catch (e) {
            // Meili 不可用不阻塞 Vendure 启动，降级为日志（后续同步请求仍会暴露问题）
            core_1.Logger.error(`MeiliSearchPlugin bootstrap failed: ${String(e)}`, constants_1.loggerCtx);
        }
    }
};
exports.MeiliSearchPlugin = MeiliSearchPlugin;
exports.MeiliSearchPlugin = MeiliSearchPlugin = MeiliSearchPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.MEILI_PLUGIN_OPTIONS, useFactory: () => MeiliSearchPlugin.options },
            meili_service_1.MeiliService,
        ],
        exports: [meili_service_1.MeiliService],
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.MEILI_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, meili_service_1.MeiliService])
], MeiliSearchPlugin);
//# sourceMappingURL=plugin.js.map