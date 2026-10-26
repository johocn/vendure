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
exports.ChatAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const permissions_1 = require("./permissions");
const chat_service_1 = require("./chat.service");
/** 后台：在线客服 IM（会话列表 / 消息 / 回复 / 关闭 / 未读角标） */
let ChatAdminResolver = class ChatAdminResolver {
    constructor(chat) {
        this.chat = chat;
    }
    async campusChatConversations(ctx, status, unreadOnly, skip, take) {
        return this.chat.adminConversations(ctx, status, unreadOnly, skip, take);
    }
    async campusChatUnread(ctx) {
        return this.chat.adminUnread(ctx);
    }
    async campusAdminChatMessages(ctx, conversationId, afterId, take) {
        return this.chat.adminMessages(ctx, conversationId, afterId, take);
    }
    async campusReplyChat(ctx, conversationId, content, images) {
        return this.chat.adminReply(ctx, conversationId, content, images);
    }
    async campusCloseChatConversation(ctx, conversationId) {
        return this.chat.adminClose(ctx, conversationId);
    }
};
exports.ChatAdminResolver = ChatAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'unreadOnly', type: () => Boolean, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Boolean, Number, Number]),
    __metadata("design:returntype", Promise)
], ChatAdminResolver.prototype, "campusChatConversations", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], ChatAdminResolver.prototype, "campusChatUnread", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __param(2, (0, graphql_1.Args)({ name: 'afterId', type: () => graphql_1.ID, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], ChatAdminResolver.prototype, "campusAdminChatMessages", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __param(2, (0, graphql_1.Args)({ name: 'content', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'images', type: () => [String], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Array]),
    __metadata("design:returntype", Promise)
], ChatAdminResolver.prototype, "campusReplyChat", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusDispatch),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ChatAdminResolver.prototype, "campusCloseChatConversation", null);
exports.ChatAdminResolver = ChatAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatAdminResolver);
//# sourceMappingURL=chat-admin.resolver.js.map