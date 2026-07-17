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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscribeMessageAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const subscribe_message_service_1 = require("./subscribe-message.service");
let SubscribeMessageAdminResolver = class SubscribeMessageAdminResolver {
    constructor(subscribeMessageService) {
        this.subscribeMessageService = subscribeMessageService;
    }
    async subscribeMessageLogs(ctx, options) {
        return this.subscribeMessageService.getSendLogs(ctx, options);
    }
};
exports.SubscribeMessageAdminResolver = SubscribeMessageAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], SubscribeMessageAdminResolver.prototype, "subscribeMessageLogs", null);
exports.SubscribeMessageAdminResolver = SubscribeMessageAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [subscribe_message_service_1.SubscribeMessageService])
], SubscribeMessageAdminResolver);
//# sourceMappingURL=subscribe-message-admin.resolver.js.map