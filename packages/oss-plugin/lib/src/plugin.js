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
var OssPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OssPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const oss_strategy_1 = require("./oss-strategy");
let OssPlugin = OssPlugin_1 = class OssPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        OssPlugin_1.options = options;
        return OssPlugin_1;
    }
};
exports.OssPlugin = OssPlugin;
exports.OssPlugin = OssPlugin = OssPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [{ provide: constants_1.OSS_PLUGIN_OPTIONS, useFactory: () => OssPlugin.options }],
        configuration: config => {
            const strategy = new oss_strategy_1.OssAssetStorageStrategy(OssPlugin.options);
            config.assetOptions.assetStorageStrategy = strategy;
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.OSS_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], OssPlugin);
//# sourceMappingURL=plugin.js.map