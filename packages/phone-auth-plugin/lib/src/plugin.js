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
var PhoneAuthPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneAuthPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const auth_resolver_1 = require("./auth.resolver");
const phone_authentication_strategy_1 = require("./phone-authentication-strategy");
const sms_service_1 = require("./sms.service");
let PhoneAuthPlugin = PhoneAuthPlugin_1 = class PhoneAuthPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        PhoneAuthPlugin_1.options = options;
        return PhoneAuthPlugin_1;
    }
};
exports.PhoneAuthPlugin = PhoneAuthPlugin;
exports.PhoneAuthPlugin = PhoneAuthPlugin = PhoneAuthPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.PHONE_AUTH_PLUGIN_OPTIONS, useFactory: () => PhoneAuthPlugin.options },
            {
                provide: sms_service_1.SmsService,
                useFactory: () => new sms_service_1.SmsService(PhoneAuthPlugin.options),
            },
            auth_resolver_1.PhoneAuthResolver,
        ],
        shopApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
                extend type Mutation {
                    sendPhoneVerificationCode(phoneNumber: String!): Boolean!
                    registerCustomer(input: PhoneRegisterInput!): Success!
                }

                input PhoneRegisterInput {
                    phoneNumber: String
                    code: String
                    emailAddress: String
                    password: String!
                }
            `;
            },
            resolvers: [auth_resolver_1.PhoneAuthResolver],
        },
        configuration: config => {
            const strategy = new phone_authentication_strategy_1.PhoneAuthenticationStrategy(PhoneAuthPlugin.options);
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                strategy,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.PHONE_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], PhoneAuthPlugin);
//# sourceMappingURL=plugin.js.map