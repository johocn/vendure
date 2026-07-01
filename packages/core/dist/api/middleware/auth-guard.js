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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const ms_1 = __importDefault(require("ms"));
const errors_1 = require("../../common/error/errors");
const config_1 = require("../../config");
const config_service_1 = require("../../config/config.service");
const vendure_logger_1 = require("../../config/logger/vendure-logger");
const customer_entity_1 = require("../../entity/customer/customer.entity");
const request_context_service_1 = require("../../service/helpers/request-context/request-context.service");
const api_key_service_1 = require("../../service/services/api-key.service");
const channel_service_1 = require("../../service/services/channel.service");
const customer_service_1 = require("../../service/services/customer.service");
const session_service_1 = require("../../service/services/session.service");
const extract_session_token_1 = require("../common/extract-session-token");
const get_api_type_1 = require("../common/get-api-type");
const is_field_resolver_1 = require("../common/is-field-resolver");
const parse_context_1 = require("../common/parse-context");
const request_context_1 = require("../common/request-context");
const set_session_token_1 = require("../common/set-session-token");
const allow_decorator_1 = require("../decorators/allow.decorator");
/**
 * @description
 * A guard which:
 *
 * 1. checks for the existence of a valid session token in the request and if found,
 * attaches the current User entity to the request.
 * 2. enforces any permissions required by the target handler (resolver, field resolver or route),
 * and throws a ForbiddenError if those permissions are not present.
 */
let AuthGuard = class AuthGuard {
    constructor(reflector, configService, requestContextService, sessionService, customerService, channelService, apiKeyService) {
        this.reflector = reflector;
        this.configService = configService;
        this.requestContextService = requestContextService;
        this.sessionService = sessionService;
        this.customerService = customerService;
        this.channelService = channelService;
        this.apiKeyService = apiKeyService;
    }
    async canActivate(context) {
        var _a;
        const { req, res, info } = (0, parse_context_1.parseContext)(context);
        const targetIsFieldResolver = (0, is_field_resolver_1.isFieldResolver)(info);
        const permissions = this.reflector.get(allow_decorator_1.PERMISSIONS_METADATA_KEY, context.getHandler());
        if (targetIsFieldResolver && !permissions) {
            return true;
        }
        const authDisabled = this.configService.authOptions.disableAuth;
        const hasOwnerPermission = !!permissions && permissions.includes(generated_types_1.Permission.Owner);
        let requestContext;
        if (targetIsFieldResolver) {
            requestContext = (0, request_context_1.internal_getRequestContext)(req);
        }
        else {
            const session = await this.getSession(req, res, hasOwnerPermission, info);
            requestContext = await this.requestContextService.fromRequest(req, info, permissions, session);
            const requestContextShouldBeReinitialized = await this.setActiveChannel(requestContext, session);
            if (requestContextShouldBeReinitialized) {
                requestContext = await this.requestContextService.fromRequest(req, info, permissions, session);
            }
            (0, request_context_1.internal_setRequestContext)(req, requestContext, context);
        }
        if (authDisabled) {
            return true;
        }
        const strategy = this.configService.authOptions.entityAccessControlStrategy;
        const isAllowed = await strategy.canAccess(requestContext, permissions !== null && permissions !== void 0 ? permissions : []);
        if (!isAllowed) {
            throw new errors_1.ForbiddenError(vendure_logger_1.LogLevel.Verbose);
        }
        await ((_a = strategy.prepareAccessControl) === null || _a === void 0 ? void 0 : _a.call(strategy, requestContext));
        return true;
    }
    async setActiveChannel(requestContext, session) {
        if (!session) {
            return false;
        }
        // In case the session does not have an activeChannelId or the activeChannelId
        // does not correspond to the current channel, the activeChannelId on the session is set
        const activeChannelShouldBeSet = !session.activeChannelId || session.activeChannelId !== requestContext.channelId;
        if (activeChannelShouldBeSet) {
            await this.sessionService.setActiveChannel(session, requestContext.channel);
            if (requestContext.activeUserId) {
                const customer = await this.customerService.findOneByUserId(requestContext, requestContext.activeUserId, false);
                // To avoid assigning the customer to the active channel on every request,
                // it is only done on the first request and whenever the channel changes
                if (customer) {
                    try {
                        await this.channelService.assignToChannels(requestContext, customer_entity_1.Customer, customer.id, [
                            requestContext.channelId,
                        ]);
                    }
                    catch (e) {
                        const isDuplicateError = e.code === 'ER_DUP_ENTRY' /* mySQL/MariaDB */ ||
                            e.code === '23505'; /* postgres */
                        if (isDuplicateError) {
                            // For a duplicate error, this means that concurrent requests have resulted in attempting to
                            // assign the Customer to the channel more than once. In this case we can safely ignore the
                            // error as the Customer was successfully assigned in the earlier call.
                            // See https://github.com/vendurehq/vendure/issues/834
                        }
                        else {
                            throw e;
                        }
                    }
                }
            }
            return true;
        }
        return false;
    }
    async getSession(req, res, hasOwnerPermission, info) {
        const sessionToken = (0, extract_session_token_1.extractSessionToken)(req, this.configService.authOptions.tokenMethod, this.configService.authOptions.apiKeyHeaderKey);
        let serializedSession;
        if (sessionToken === null || sessionToken === void 0 ? void 0 : sessionToken.token) {
            serializedSession = await this.getSessionFromToken(req, sessionToken, info);
            if (serializedSession) {
                return serializedSession;
            }
            // if there is a token but it cannot be validated to a Session,
            // then the token is no longer valid and should be unset.
            (0, set_session_token_1.setSessionToken)({
                req,
                res,
                authOptions: this.configService.authOptions,
                rememberMe: false,
                sessionToken: '',
            });
        }
        if (hasOwnerPermission && !serializedSession) {
            serializedSession = await this.sessionService.createAnonymousSession();
            (0, set_session_token_1.setSessionToken)({
                sessionToken: serializedSession.token,
                rememberMe: true,
                authOptions: this.configService.authOptions,
                req,
                res,
            });
        }
        return serializedSession;
    }
    async getSessionFromToken(req, extracted, info) {
        if (extracted.method !== 'api-key') {
            return this.sessionService.getSessionFromToken(extracted.token);
        }
        const strategy = this.apiKeyService.getApiKeyStrategyByApiType((0, get_api_type_1.getApiType)(info));
        const parseResult = strategy.parse(extracted.token);
        if (!parseResult) {
            return;
        }
        const ctx = await this.requestContextService.fromRequest(req, info);
        const apiKey = await this.apiKeyService.findOneByLookupId(ctx, parseResult.lookupId, [
            'user',
            'user.roles',
            'user.roles.channels',
        ]);
        if (!apiKey) {
            return;
        }
        const isHashMatching = await strategy.hashingStrategy.check(extracted.token, apiKey.apiKeyHash);
        if (!isHashMatching) {
            return;
        }
        const lastUsedThreshold = new Date(Date.now() -
            (typeof strategy.lastUsedAtUpdateInterval === 'string'
                ? (0, ms_1.default)(strategy.lastUsedAtUpdateInterval)
                : strategy.lastUsedAtUpdateInterval));
        if (!apiKey.lastUsedAt || apiKey.lastUsedAt < lastUsedThreshold) {
            this.apiKeyService
                .updateLastUsedAtByLookupId(apiKey.lookupId)
                // Update the lastUsedAt timestamp in the background, we don't want to hold up the request
                .catch(err => vendure_logger_1.Logger.error(`Failed to update lastUsedAt for ApiKey with lookupId ${parseResult.lookupId}`, undefined, err === null || err === void 0 ? void 0 : err.stack));
        }
        const session = await this.sessionService.getSessionFromToken(apiKey.apiKeyHash);
        if (session) {
            return session;
        }
        // At this point we may assert:
        // 1. The token came from the api-key header
        // 2. The hash matches
        // 3. There is no session
        // We can conclude that the API-Key is actually broken.
        // For example someone could have deleted the session manually in the DB.
        // We must create a new session, otherwise the API-Key is unusable.
        await this.sessionService.createNewAuthenticatedSession(ctx, apiKey.user, config_1.API_KEY_AUTH_STRATEGY_NAME, apiKey.apiKeyHash);
        return this.sessionService.getSessionFromToken(apiKey.apiKeyHash);
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        config_service_1.ConfigService,
        request_context_service_1.RequestContextService,
        session_service_1.SessionService,
        customer_service_1.CustomerService,
        channel_service_1.ChannelService,
        api_key_service_1.ApiKeyService])
], AuthGuard);
//# sourceMappingURL=auth-guard.js.map