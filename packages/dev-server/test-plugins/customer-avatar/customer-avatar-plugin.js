"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAvatarPlugin = void 0;
const core_1 = require("@vendure/core");
const api_extensions_1 = require("./api-extensions");
const customer_avatar_resolver_1 = require("./customer-avatar.resolver");
let CustomerAvatarPlugin = class CustomerAvatarPlugin {
};
exports.CustomerAvatarPlugin = CustomerAvatarPlugin;
exports.CustomerAvatarPlugin = CustomerAvatarPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [customer_avatar_resolver_1.CustomerAvatarResolver],
        },
        configuration: config => {
            config.customFields.Customer.push({
                name: 'avatar',
                type: 'relation',
                entity: core_1.Asset,
                nullable: true,
            });
            return config;
        },
    })
], CustomerAvatarPlugin);
//# sourceMappingURL=customer-avatar-plugin.js.map