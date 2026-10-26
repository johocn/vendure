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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusChatMessage = exports.CampusChatConversation = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 在线客服会话（P0-3）：顾客 ↔ 平台/商家的实时 IM 会话。
 * 表已由 p8-p0-privacy-food-safety 迁移建好，环境 synchronize:false，实体只做读写映射。
 */
let CampusChatConversation = class CampusChatConversation extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusChatConversation = CampusChatConversation;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "orderCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'open' }),
    __metadata("design:type", String)
], CampusChatConversation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "lastMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "lastMessageAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "lastSenderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusChatConversation.prototype, "unreadForCustomer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampusChatConversation.prototype, "unreadForAdmin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusChatConversation.prototype, "closedAt", void 0);
exports.CampusChatConversation = CampusChatConversation = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_chat_conv_channel', ['channelId', 'lastMessageAt']),
    (0, typeorm_1.Index)('idx_campus_chat_conv_customer', ['channelId', 'customerId']),
    __metadata("design:paramtypes", [Object])
], CampusChatConversation);
/** 会话消息：senderType=customer/admin（商家与平台运营共用 admin 侧） */
let CampusChatMessage = class CampusChatMessage extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CampusChatMessage = CampusChatMessage;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], CampusChatMessage.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CampusChatMessage.prototype, "senderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CampusChatMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CampusChatMessage.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], CampusChatMessage.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CampusChatMessage.prototype, "readAt", void 0);
exports.CampusChatMessage = CampusChatMessage = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_campus_chat_msg_conv', ['conversationId', 'id']),
    __metadata("design:paramtypes", [Object])
], CampusChatMessage);
//# sourceMappingURL=chat.entities.js.map