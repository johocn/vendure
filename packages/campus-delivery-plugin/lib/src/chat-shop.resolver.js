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
exports.ChatShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const chat_service_1 = require("./chat.service");
/** C 端：在线客服 IM（发起会话 / 会话列表 / 增量消息 / 发消息 / 已读 / 结束） */
let ChatShopResolver = class ChatShopResolver {
    constructor(chat) {
        this.chat = chat;
    }
    async campusStartChat(ctx, orderCode, subject) {
        return this.chat.startConversation(ctx, orderCode, subject);
    }
    async campusMyChatConversations(ctx, skip, take) {
        return this.chat.myConversations(ctx, skip, take);
    }
    async campusChatMessages(ctx, conversationId, afterId, take) {
        return this.chat.messages(ctx, conversationId, afterId, take);
    }
    async campusSendChatMessage(ctx, conversationId, content, images) {
        return this.chat.sendMessage(ctx, conversationId, content, images);
    }
    async campusMarkChatRead(ctx, conversationId) {
        return this.chat.markRead(ctx, conversationId);
    }
    async campusCloseChat(ctx, conversationId) {
        return this.chat.closeConversation(ctx, conversationId);
    }
};
exports.ChatShopResolver = ChatShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'orderCode', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'subject', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusStartChat", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusMyChatConversations", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __param(2, (0, graphql_1.Args)({ name: 'afterId', type: () => graphql_1.ID, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusChatMessages", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __param(2, (0, graphql_1.Args)({ name: 'content', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'images', type: () => [String], nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String, Array]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusSendChatMessage", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusMarkChatRead", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('conversationId', { type: () => graphql_1.ID })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ChatShopResolver.prototype, "campusCloseChat", null);
exports.ChatShopResolver = ChatShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatShopResolver);
//# sourceMappingURL=chat-shop.resolver.js.map