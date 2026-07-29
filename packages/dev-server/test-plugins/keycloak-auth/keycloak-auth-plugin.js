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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakAuthPlugin = void 0;
const axios_1 = require("@nestjs/axios");
const core_1 = require("@vendure/core");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const keycloak_authentication_strategy_1 = require("./keycloak-authentication-strategy");
/**
 * A demo plugin which configures an AuthenticationStrategy for a KeyCloak ID server.
 *
 * Assumes that KeyCloak is running on port 9000, with a realm configured named "myrealm"
 * and a client named "vendure".
 *
 * Add the plugin to the VendureConfig and set the Admin UI `loginUrl` option to
 * "http://localhost:3000/keycloak-login".
 *
 * Video demo of this: https://youtu.be/Tj4kwjNd2nM
 */
let KeycloakAuthPlugin = class KeycloakAuthPlugin {
    configure(consumer) {
        consumer.apply(express_1.default.static(path_1.default.join(__dirname, 'public'))).forRoutes('keycloak-login');
    }
};
exports.KeycloakAuthPlugin = KeycloakAuthPlugin;
exports.KeycloakAuthPlugin = KeycloakAuthPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule, axios_1.HttpModule],
        configuration: config => {
            config.authOptions.adminAuthenticationStrategy = [
                ...config.authOptions.adminAuthenticationStrategy,
                new keycloak_authentication_strategy_1.KeycloakAuthenticationStrategy(),
            ];
            return config;
        },
    })
], KeycloakAuthPlugin);
//# sourceMappingURL=keycloak-auth-plugin.js.map