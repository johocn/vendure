import { Injectable } from '@nestjs/common';
import {
    ID,
    ListQueryBuilder,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Repository } from 'typeorm';

import { loggerCtx } from './constants';
import { MessageDelivery } from './entities/message-delivery.entity';
import { Message } from './entities/message.entity';
import { MessagePushService } from './message-push.service';
import { DEFAULT_BATCH_SIZE } from './types';

@Injectable()
export class MessageService {
    private messageRepo: Repository<Message>;
    private deliveryRepo: Repository<MessageDelivery>;

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private pushService: MessagePushService,
    ) {
        this.messageRepo = this.connection.rawConnection.getRepository(Message);
        this.deliveryRepo = this.connection.rawConnection.getRepository(MessageDelivery);
    }

    async findAll(ctx: RequestContext, options?: any): Promise<PaginatedList<Message>> {
        return this.listQueryBuilder
            .build(Message, options, { ctx, channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Message | null> {
        return this.messageRepo.findOne({ where: { id: id as any } });
    }

    async create(ctx: RequestContext, input: any): Promise<Message> {
        const msg = new Message({
            title: input.title,
            body: input.body,
            deliveryChannel: input.deliveryChannel ?? 'inapp',
            audienceType: input.audienceType ?? 'all',
            audienceLevel: input.audienceLevel,
            status: 'draft',
        } as any);
        msg.channels = [ctx.channel];
        return this.messageRepo.save(msg);
    }

    async update(ctx: RequestContext, id: ID, input: any): Promise<Message> {
        const msg = await this.findOne(ctx, id);
        if (!msg) throw new UserInputError(`Message ${id} not found`);
        if (msg.status === 'sending' || msg.status === 'sent') {
            throw new UserInputError(`Cannot edit message in ${msg.status} state`);
        }
        Object.assign(msg, {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.body !== undefined && { body: input.body }),
            ...(input.deliveryChannel !== undefined && { deliveryChannel: input.deliveryChannel }),
            ...(input.audienceType !== undefined && { audienceType: input.audienceType }),
            ...(input.audienceLevel !== undefined && { audienceLevel: input.audienceLevel }),
        });
        return this.messageRepo.save(msg);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const msg = await this.findOne(ctx, id);
        if (!msg) return false;
        await this.messageRepo.remove(msg);
        return true;
    }

    async sendMessage(ctx: RequestContext, id: ID): Promise<Message> {
        const msg = await this.findOne(ctx, id);
        if (!msg) throw new UserInputError(`Message ${id} not found`);
        if (msg.status !== 'draft') {
            throw new UserInputError(`Message ${id} is not in draft state (current: ${msg.status})`);
        }
        msg.status = 'pending';
        await this.messageRepo.save(msg);
        return msg;
    }

    /**
     * 由 JobQueue worker 调用，实际执行发送。
     */
    async processSending(ctx: RequestContext, messageId: ID): Promise<void> {
        const msg = await this.messageRepo.findOne({ where: { id: messageId as any } });
        if (!msg) {
            Logger.warn(`Message ${messageId} not found, skipping`, loggerCtx);
            return;
        }
        if (msg.status !== 'pending') {
            Logger.warn(`Message ${messageId} status is ${msg.status}, skipping`, loggerCtx);
            return;
        }

        msg.status = 'sending';
        await this.messageRepo.save(msg);

        try {
            const customerIds = await this.getTargetCustomerIds(ctx, msg);
            msg.totalTarget = customerIds.length;
            await this.messageRepo.save(msg);

            const batchSize = DEFAULT_BATCH_SIZE;
            let sent = 0;
            let failed = 0;

            for (let i = 0; i < customerIds.length; i += batchSize) {
                const batch = customerIds.slice(i, i + batchSize);
                for (const customerId of batch) {
                    const delivery = new MessageDelivery({
                        messageId: msg.id,
                        customerId,
                        deliveryStatus: 'pending',
                    } as any);
                    delivery.channels = [ctx.channel];
                    await this.deliveryRepo.save(delivery);

                    try {
                        if (msg.deliveryChannel === 'push') {
                            await this.pushService.sendPush(ctx, customerId, msg.title, msg.body);
                        }
                        delivery.deliveryStatus = 'sent';
                        await this.deliveryRepo.save(delivery);
                        sent++;
                    } catch (e: any) {
                        delivery.deliveryStatus = 'failed';
                        delivery.deliveryError = e.message?.slice(0, 500);
                        await this.deliveryRepo.save(delivery);
                        failed++;
                        Logger.error(`Delivery failed for customer ${customerId}: ${e.message}`, loggerCtx);
                    }
                }
            }

            msg.totalSent = sent;
            msg.totalFailed = failed;
            msg.status = 'sent';
            msg.sentAt = new Date();
            await this.messageRepo.save(msg);
            Logger.info(`Message ${messageId} sent: ${sent} success, ${failed} failed`, loggerCtx);
        } catch (e: any) {
            msg.status = 'failed';
            await this.messageRepo.save(msg);
            Logger.error(`Message ${messageId} sending failed: ${e.message}`, loggerCtx);
            throw e;
        }
    }

    async getDeliveryStats(ctx: RequestContext, messageId: ID): Promise<any> {
        const msg = await this.findOne(ctx, messageId);
        if (!msg) throw new UserInputError(`Message ${messageId} not found`);
        const totalRead = await this.deliveryRepo
            .createQueryBuilder('d')
            .where('d.messageId = :mid', { mid: messageId })
            .andWhere('d.readAt IS NOT NULL')
            .getCount();
        return {
            totalTarget: msg.totalTarget,
            totalSent: msg.totalSent,
            totalFailed: msg.totalFailed,
            totalRead,
        };
    }

    private async getTargetCustomerIds(ctx: RequestContext, msg: Message): Promise<number[]> {
        const repo = this.connection.getRepository(ctx, 'Customer' as any);
        const qb = repo.createQueryBuilder('customer').select('customer.id', 'id');

        if (msg.audienceType === 'level') {
            qb.andWhere('customer.customFields_memberLevel = :level', { level: msg.audienceLevel ?? 1 });
        }
        qb.andWhere('customer.deletedAt IS NULL');

        const rows = await qb.getRawMany();
        return rows.map(r => Number(r.id));
    }

    // ===== Shop-api methods =====

    async findMyMessages(ctx: RequestContext, options?: any): Promise<PaginatedList<any>> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);
        const customer = await customerRepo
            .createQueryBuilder('c')
            .select('c.id')
            .innerJoin('c.user', 'user')
            .where('user.id = :userId', { userId: ctx.activeUserId })
            .getOne();
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        const qb = this.deliveryRepo
            .createQueryBuilder('d')
            .innerJoinAndSelect('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: customer.id })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('d.deliveryStatus = :status', { status: 'sent' })
            .orderBy('d.createdAt', 'DESC');

        if (options?.skip) qb.skip(options.skip);
        if (options?.take) qb.take(options.take);

        const [deliveries, totalItems] = await qb.getManyAndCount();
        const messageIds = deliveries.map(d => d.messageId);
        const messages = messageIds.length > 0
            ? await this.messageRepo.findByIds(messageIds)
            : [];
        const msgMap = new Map(messages.map(m => [m.id, m]));

        return {
            items: deliveries.map(d => {
                const m = msgMap.get(d.messageId);
                return {
                    id: d.id,
                    messageId: d.messageId,
                    title: m?.title ?? '',
                    body: m?.body ?? '',
                    readAt: d.readAt,
                    createdAt: d.createdAt,
                };
            }),
            totalItems,
        };
    }

    async getMyUnreadCount(ctx: RequestContext): Promise<number> {
        if (!ctx.activeUserId) return 0;
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);
        const customer = await customerRepo
            .createQueryBuilder('c')
            .select('c.id')
            .innerJoin('c.user', 'user')
            .where('user.id = :userId', { userId: ctx.activeUserId })
            .getOne();
        if (!customer) return 0;

        return this.deliveryRepo
            .createQueryBuilder('d')
            .innerJoin('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: customer.id })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('d.deliveryStatus = :status', { status: 'sent' })
            .andWhere('d.readAt IS NULL')
            .getCount();
    }

    async markRead(ctx: RequestContext, deliveryId: ID): Promise<boolean> {
        if (!ctx.activeUserId) return false;
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId as any } });
        if (!delivery) return false;
        delivery.readAt = new Date();
        await this.deliveryRepo.save(delivery);
        return true;
    }
}
