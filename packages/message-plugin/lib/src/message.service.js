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
exports.MessageService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const message_delivery_entity_1 = require("./entities/message-delivery.entity");
const message_entity_1 = require("./entities/message.entity");
const message_push_service_1 = require("./message-push.service");
const types_1 = require("./types");
let MessageService = class MessageService {
    constructor(connection, listQueryBuilder, pushService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.pushService = pushService;
        this.messageRepo = this.connection.rawConnection.getRepository(message_entity_1.Message);
        this.deliveryRepo = this.connection.rawConnection.getRepository(message_delivery_entity_1.MessageDelivery);
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(message_entity_1.Message, options, { ctx, channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOne(ctx, id) {
        return this.messageRepo.findOne({ where: { id: id } });
    }
    async create(ctx, input) {
        var _a, _b;
        const msg = new message_entity_1.Message({
            title: input.title,
            body: input.body,
            deliveryChannel: (_a = input.deliveryChannel) !== null && _a !== void 0 ? _a : 'inapp',
            audienceType: (_b = input.audienceType) !== null && _b !== void 0 ? _b : 'all',
            audienceLevel: input.audienceLevel,
            status: 'draft',
        });
        msg.channels = [ctx.channel];
        return this.messageRepo.save(msg);
    }
    async update(ctx, id, input) {
        const msg = await this.findOne(ctx, id);
        if (!msg)
            throw new core_1.UserInputError(`Message ${id} not found`);
        if (msg.status === 'sending' || msg.status === 'sent') {
            throw new core_1.UserInputError(`Cannot edit message in ${msg.status} state`);
        }
        Object.assign(msg, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (input.title !== undefined && { title: input.title })), (input.body !== undefined && { body: input.body })), (input.deliveryChannel !== undefined && { deliveryChannel: input.deliveryChannel })), (input.audienceType !== undefined && { audienceType: input.audienceType })), (input.audienceLevel !== undefined && { audienceLevel: input.audienceLevel })));
        return this.messageRepo.save(msg);
    }
    async delete(ctx, id) {
        const msg = await this.findOne(ctx, id);
        if (!msg)
            return false;
        await this.messageRepo.remove(msg);
        return true;
    }
    async sendMessage(ctx, id) {
        const msg = await this.findOne(ctx, id);
        if (!msg)
            throw new core_1.UserInputError(`Message ${id} not found`);
        if (msg.status !== 'draft') {
            throw new core_1.UserInputError(`Message ${id} is not in draft state (current: ${msg.status})`);
        }
        msg.status = 'pending';
        await this.messageRepo.save(msg);
        return msg;
    }
    /**
     * 由 JobQueue worker 调用，实际执行发送。
     */
    async processSending(ctx, messageId) {
        var _a;
        const msg = await this.messageRepo.findOne({ where: { id: messageId } });
        if (!msg) {
            core_1.Logger.warn(`Message ${messageId} not found, skipping`, constants_1.loggerCtx);
            return;
        }
        if (msg.status !== 'pending') {
            core_1.Logger.warn(`Message ${messageId} status is ${msg.status}, skipping`, constants_1.loggerCtx);
            return;
        }
        msg.status = 'sending';
        await this.messageRepo.save(msg);
        try {
            const customerIds = await this.getTargetCustomerIds(ctx, msg);
            msg.totalTarget = customerIds.length;
            await this.messageRepo.save(msg);
            const batchSize = types_1.DEFAULT_BATCH_SIZE;
            let sent = 0;
            let failed = 0;
            for (let i = 0; i < customerIds.length; i += batchSize) {
                const batch = customerIds.slice(i, i + batchSize);
                for (const customerId of batch) {
                    const delivery = new message_delivery_entity_1.MessageDelivery({
                        messageId: msg.id,
                        customerId,
                        deliveryStatus: 'pending',
                    });
                    delivery.channels = [ctx.channel];
                    await this.deliveryRepo.save(delivery);
                    try {
                        if (msg.deliveryChannel === 'push') {
                            await this.pushService.sendPush(ctx, customerId, msg.title, msg.body);
                        }
                        delivery.deliveryStatus = 'sent';
                        await this.deliveryRepo.save(delivery);
                        sent++;
                    }
                    catch (e) {
                        delivery.deliveryStatus = 'failed';
                        delivery.deliveryError = (_a = e.message) === null || _a === void 0 ? void 0 : _a.slice(0, 500);
                        await this.deliveryRepo.save(delivery);
                        failed++;
                        core_1.Logger.error(`Delivery failed for customer ${customerId}: ${e.message}`, constants_1.loggerCtx);
                    }
                }
            }
            msg.totalSent = sent;
            msg.totalFailed = failed;
            msg.status = 'sent';
            msg.sentAt = new Date();
            await this.messageRepo.save(msg);
            core_1.Logger.info(`Message ${messageId} sent: ${sent} success, ${failed} failed`, constants_1.loggerCtx);
        }
        catch (e) {
            msg.status = 'failed';
            await this.messageRepo.save(msg);
            core_1.Logger.error(`Message ${messageId} sending failed: ${e.message}`, constants_1.loggerCtx);
            throw e;
        }
    }
    async getDeliveryStats(ctx, messageId) {
        const msg = await this.findOne(ctx, messageId);
        if (!msg)
            throw new core_1.UserInputError(`Message ${messageId} not found`);
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
    async getTargetCustomerIds(ctx, msg) {
        var _a;
        const repo = this.connection.getRepository(ctx, 'Customer');
        const qb = repo.createQueryBuilder('customer').select('customer.id', 'id');
        if (msg.audienceType === 'level') {
            qb.andWhere('customer.customFields_memberLevel = :level', { level: (_a = msg.audienceLevel) !== null && _a !== void 0 ? _a : 1 });
        }
        qb.andWhere('customer.deletedAt IS NULL');
        const rows = await qb.getRawMany();
        return rows.map(r => Number(r.id));
    }
    // ===== Shop-api methods =====
    async findMyMessages(ctx, options) {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customerRepo = this.connection.getRepository(ctx, 'Customer');
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
        if (options === null || options === void 0 ? void 0 : options.skip)
            qb.skip(options.skip);
        if (options === null || options === void 0 ? void 0 : options.take)
            qb.take(options.take);
        const [deliveries, totalItems] = await qb.getManyAndCount();
        const messageIds = deliveries.map(d => d.messageId);
        const messages = messageIds.length > 0
            ? await this.messageRepo.findByIds(messageIds)
            : [];
        const msgMap = new Map(messages.map(m => [m.id, m]));
        return {
            items: deliveries.map(d => {
                var _a, _b;
                const m = msgMap.get(d.messageId);
                return {
                    id: d.id,
                    messageId: d.messageId,
                    title: (_a = m === null || m === void 0 ? void 0 : m.title) !== null && _a !== void 0 ? _a : '',
                    body: (_b = m === null || m === void 0 ? void 0 : m.body) !== null && _b !== void 0 ? _b : '',
                    readAt: d.readAt,
                    createdAt: d.createdAt,
                };
            }),
            totalItems,
        };
    }
    async getMyUnreadCount(ctx) {
        if (!ctx.activeUserId)
            return 0;
        const customerRepo = this.connection.getRepository(ctx, 'Customer');
        const customer = await customerRepo
            .createQueryBuilder('c')
            .select('c.id')
            .innerJoin('c.user', 'user')
            .where('user.id = :userId', { userId: ctx.activeUserId })
            .getOne();
        if (!customer)
            return 0;
        return this.deliveryRepo
            .createQueryBuilder('d')
            .innerJoin('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: customer.id })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('d.deliveryStatus = :status', { status: 'sent' })
            .andWhere('d.readAt IS NULL')
            .getCount();
    }
    async markRead(ctx, deliveryId) {
        if (!ctx.activeUserId)
            return false;
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery)
            return false;
        delivery.readAt = new Date();
        await this.deliveryRepo.save(delivery);
        return true;
    }
};
exports.MessageService = MessageService;
exports.MessageService = MessageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        message_push_service_1.MessagePushService])
], MessageService);
