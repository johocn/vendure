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
exports.SupportTicketService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const credential_service_1 = require("./credential.service");
const wechat_support_ticket_entity_1 = require("./entities/wechat-support-ticket.entity");
const constants_1 = require("./constants");
const wechat_sender_1 = require("./wechat-sender");
/** 留言工单：落库 + 后台列表 + 后台回复（客服消息下发到用户） */
let SupportTicketService = class SupportTicketService {
    constructor(connection, sender, credentialService) {
        this.connection = connection;
        this.sender = sender;
        this.credentialService = credentialService;
    }
    async create(ctx, input) {
        var _a, _b, _c, _d;
        const repo = this.connection.getRepository(ctx, wechat_support_ticket_entity_1.WechatSupportTicket);
        return repo.save(repo.create({
            openid: input.openid,
            channelId: input.channelId,
            customerId: (_a = input.customerId) !== null && _a !== void 0 ? _a : null,
            storeId: (_b = input.storeId) !== null && _b !== void 0 ? _b : null,
            storeName: (_c = input.storeName) !== null && _c !== void 0 ? _c : null,
            summary: (_d = input.summary) !== null && _d !== void 0 ? _d : null,
            content: input.content,
            status: 'open',
            reply: null,
            repliedAt: null,
        }));
    }
    /** 后台工单列表（按创建时间倒序；status 可筛选 open/replied） */
    async list(ctx, options = {}) {
        var _a;
        const repo = this.connection.getRepository(ctx, wechat_support_ticket_entity_1.WechatSupportTicket);
        const qb = repo
            .createQueryBuilder('ticket')
            .orderBy('ticket.createdAt', 'DESC')
            .take(Math.min(Math.max((_a = options.limit) !== null && _a !== void 0 ? _a : 20, 1), 100));
        if (options.status) {
            qb.andWhere('ticket.status = :status', { status: options.status });
        }
        return qb.getMany();
    }
    /**
     * 后台回复：先经公众号客服消息下发，成功后再落库（48 小时窗口外的发送失败会直接报给运营，
     * 由运营改用电话联系，避免「后台显示已回复但用户没收到」）。
     */
    async reply(ctx, id, content) {
        const text = content.trim();
        if (!text)
            throw new core_1.UserInputError('回复内容不能为空');
        const repo = this.connection.getRepository(ctx, wechat_support_ticket_entity_1.WechatSupportTicket);
        const ticket = await repo.findOne({ where: { id: id } });
        if (!ticket)
            throw new core_1.UserInputError('留言不存在');
        if (!ticket.channelId)
            throw new core_1.UserInputError('留言缺少渠道信息，无法下发');
        const channel = await this.connection.getRepository(ctx, core_1.Channel).findOne({ where: { id: ticket.channelId } });
        if (!channel)
            throw new core_1.UserInputError('留言所属渠道不存在');
        const credentials = await this.credentialService.resolveForChannel(channel.token, {});
        try {
            await this.sender.send({ kind: 'text', touser: ticket.openid, content: `【客服回复】${text}` }, credentials);
        }
        catch (e) {
            core_1.Logger.warn(`Support ticket reply delivery failed: ticket=${ticket.id} ${String(e)}`, constants_1.loggerCtx);
            throw new core_1.UserInputError(`回复下发失败（可能已超出微信 48 小时会话窗口）：${String(e)}`);
        }
        ticket.reply = text;
        ticket.status = 'replied';
        ticket.repliedAt = new Date();
        const saved = await repo.save(ticket);
        core_1.Logger.info(`Support ticket replied: id=${ticket.id} openid=${ticket.openid}`, constants_1.loggerCtx);
        return saved;
    }
};
exports.SupportTicketService = SupportTicketService;
exports.SupportTicketService = SupportTicketService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        wechat_sender_1.WechatSender,
        credential_service_1.CredentialService])
], SupportTicketService);
//# sourceMappingURL=support-ticket.service.js.map