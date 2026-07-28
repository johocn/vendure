"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DeliveryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryPlugin = void 0;
// e:\code\vendure\packages\delivery-plugin\src\delivery.plugin.ts
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let DeliveryPlugin = DeliveryPlugin_1 = class DeliveryPlugin {
};
exports.DeliveryPlugin = DeliveryPlugin;
DeliveryPlugin.init = () => new DeliveryPlugin_1();
exports.DeliveryPlugin = DeliveryPlugin = DeliveryPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: (config) => {
            var _a;
            // 注册自定义 Permission
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...constants_1.deliveryPermissionDefinitions,
            ];
            // 扩展 Order customFields（Task 2 会补充）
            // 扩展 Address customFields（Task 2 会补充）
            return config;
        },
    })
], DeliveryPlugin);
