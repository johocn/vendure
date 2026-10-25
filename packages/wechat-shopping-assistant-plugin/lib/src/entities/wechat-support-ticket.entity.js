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
exports.WechatSupportTicket = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 微信购物助手「留言」工单（PRD FR-07）：
 * 用户在任何一步回复「留言」→ 写下问题 → 落库；门店/平台在后台回复后经公众号会话下发。
 * 会话状态与工单解耦：工单保存后原状态机照常恢复。
 */
let WechatSupportTicket = class WechatSupportTicket extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.WechatSupportTicket = WechatSupportTicket;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], WechatSupportTicket.prototype, "openid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "storeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], WechatSupportTicket.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'open' }),
    __metadata("design:type", String)
], WechatSupportTicket.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "reply", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], WechatSupportTicket.prototype, "repliedAt", void 0);
exports.WechatSupportTicket = WechatSupportTicket = __decorate([
    (0, typeorm_1.Entity)({ name: 'wechat_support_ticket' }),
    (0, typeorm_1.Index)(['status', 'createdAt']),
    __metadata("design:paramtypes", [Object])
], WechatSupportTicket);
//# sourceMappingURL=wechat-support-ticket.entity.js.map