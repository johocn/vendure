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
exports.SupportTicketAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const support_ticket_service_1 = require("./support-ticket.service");
/** 留言工单后台接口：列表 + 回复（回复经公众号客服消息下发到用户） */
let SupportTicketAdminResolver = class SupportTicketAdminResolver {
    constructor(supportTickets) {
        this.supportTickets = supportTickets;
    }
    async wechatSupportTickets(ctx, limit, status) {
        return this.supportTickets.list(ctx, { limit, status });
    }
    async replyWechatSupportTicket(ctx, id, content) {
        if (!(content === null || content === void 0 ? void 0 : content.trim()))
            throw new core_1.UserInputError('回复内容不能为空');
        return this.supportTickets.reply(ctx, id, content);
    }
};
exports.SupportTicketAdminResolver = SupportTicketAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('limit')),
    __param(2, (0, graphql_1.Args)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, String]),
    __metadata("design:returntype", Promise)
], SupportTicketAdminResolver.prototype, "wechatSupportTickets", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('content')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], SupportTicketAdminResolver.prototype, "replyWechatSupportTicket", null);
exports.SupportTicketAdminResolver = SupportTicketAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [support_ticket_service_1.SupportTicketService])
], SupportTicketAdminResolver);
//# sourceMappingURL=support-ticket-admin.resolver.js.map