import { Injectable } from '@nestjs/common';
import { Channel, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { CredentialService } from './credential.service';
import { WechatSupportTicket } from './entities/wechat-support-ticket.entity';
import { loggerCtx } from './constants';
import { WechatSender } from './wechat-sender';

export interface CreateSupportTicketInput {
    openid: string;
    channelId: number;
    customerId?: number | null;
    storeId?: string | null;
    storeName?: string | null;
    summary?: string | null;
    content: string;
}

/** 留言工单：落库 + 后台列表 + 后台回复（客服消息下发到用户） */
@Injectable()
export class SupportTicketService {
    constructor(
        private connection: TransactionalConnection,
        private sender: WechatSender,
        private credentialService: CredentialService,
    ) {}

    async create(ctx: RequestContext, input: CreateSupportTicketInput): Promise<WechatSupportTicket> {
        const repo = this.connection.getRepository(ctx, WechatSupportTicket);
        return repo.save(
            repo.create({
                openid: input.openid,
                channelId: input.channelId,
                customerId: input.customerId ?? null,
                storeId: input.storeId ?? null,
                storeName: input.storeName ?? null,
                summary: input.summary ?? null,
                content: input.content,
                status: 'open',
                reply: null,
                repliedAt: null,
            }),
        );
    }

    /** 后台工单列表（按创建时间倒序；status 可筛选 open/replied） */
    async list(ctx: RequestContext, options: { limit?: number; status?: string } = {}): Promise<WechatSupportTicket[]> {
        const repo = this.connection.getRepository(ctx, WechatSupportTicket);
        const qb = repo
            .createQueryBuilder('ticket')
            .orderBy('ticket.createdAt', 'DESC')
            .take(Math.min(Math.max(options.limit ?? 20, 1), 100));
        if (options.status) {
            qb.andWhere('ticket.status = :status', { status: options.status });
        }
        return qb.getMany();
    }

    /**
     * 后台回复：先经公众号客服消息下发，成功后再落库（48 小时窗口外的发送失败会直接报给运营，
     * 由运营改用电话联系，避免「后台显示已回复但用户没收到」）。
     */
    async reply(ctx: RequestContext, id: string | number, content: string): Promise<WechatSupportTicket> {
        const text = content.trim();
        if (!text) throw new UserInputError('回复内容不能为空');
        const repo = this.connection.getRepository(ctx, WechatSupportTicket);
        const ticket = await repo.findOne({ where: { id: id as any } });
        if (!ticket) throw new UserInputError('留言不存在');
        if (!ticket.channelId) throw new UserInputError('留言缺少渠道信息，无法下发');
        const channel = await this.connection.getRepository(ctx, Channel).findOne({ where: { id: ticket.channelId as any } });
        if (!channel) throw new UserInputError('留言所属渠道不存在');

        const credentials = await this.credentialService.resolveForChannel(channel.token, {});
        try {
            await this.sender.send({ kind: 'text', touser: ticket.openid, content: `【客服回复】${text}` }, credentials);
        } catch (e) {
            Logger.warn(`Support ticket reply delivery failed: ticket=${ticket.id} ${String(e)}`, loggerCtx);
            throw new UserInputError(`回复下发失败（可能已超出微信 48 小时会话窗口）：${String(e)}`);
        }

        ticket.reply = text;
        ticket.status = 'replied';
        ticket.repliedAt = new Date();
        const saved = await repo.save(ticket);
        Logger.info(`Support ticket replied: id=${ticket.id} openid=${ticket.openid}`, loggerCtx);
        return saved;
    }
}
