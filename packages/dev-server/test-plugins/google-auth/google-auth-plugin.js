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
var GoogleAuthPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthPlugin = void 0;
const core_1 = require("@vendure/core");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const google_authentication_strategy_1 = require("./google-authentication-strategy");
/**
 * An demo implementation of a Google login flow.
 *
 * To run this you'll need to install `google-auth-library` from npm.
 *
 * Then add this plugin to the dev config.
 *
 * The "storefront" is a simple html file which is served on http://localhost:3000/google-login,
 * but to get it to work with the Google login button you'll need to resolve it to some
 * public-looking url such as `http://google-login-test.com` by modifying your OS
 * hosts file.
 */
let GoogleAuthPlugin = GoogleAuthPlugin_1 = class GoogleAuthPlugin {
    static init(options) {
        this.options = options;
        return GoogleAuthPlugin_1;
    }
    configure(consumer) {
        consumer.apply(express_1.default.static(path_1.default.join(__dirname, 'public'))).forRoutes('google-login');
    }
};
exports.GoogleAuthPlugin = GoogleAuthPlugin;
exports.GoogleAuthPlugin = GoogleAuthPlugin = GoogleAuthPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: config => {
            config.authOptions.shopAuthenticationStrategy = [
                ...config.authOptions.shopAuthenticationStrategy,
                new google_authentication_strategy_1.GoogleAuthenticationStrategy(GoogleAuthPlugin.options.clientId),
            ];
            return config;
        },
    })
], GoogleAuthPlugin);
//# sourceMappingURL=google-auth-plugin.js.map