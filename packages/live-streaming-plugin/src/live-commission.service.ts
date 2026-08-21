import { Injectable } from '@nestjs/common';
import { Channel, EventBus, Logger, Order, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';
import { CommissionRecord, Distributor } from '@vendure/distribution-plugin';
import { LiveRoom } from './live-room.entity';
import { LiveStreamingPluginOptions } from './types';
import { loggerCtx } from './constants';

@Injectable()
export class LiveCommissionService {
    private initialized = false;
    private opts: LiveStreamingPluginOptions = {};

    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
    ) {}

    setOptions(opts: LiveStreamingPluginOptions): void { this.opts = opts; }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Settled') return;
            try {
                await this.calculateLiveCommission(event);
            } catch (e: any) {
                Logger.error(`Failed live commission for order ${event.order.id}: ${e.message}`, loggerCtx);
            }
        });
    }

    /** 绑定直播间来源（下单前调用） */
    async setOrderLiveRoom(ctx: RequestContext, orderId: string, roomId: string): Promise<void> {
        const repo = this.connection.getRepository(ctx, Order);
        const order = await repo.findOne({ where: { id: orderId } as any });
        if (!order) throw new Error('Order not found');
        (order as any).customFields = { ...(order as any).customFields, liveRoomId: Number(roomId) };
        await repo.save(order);
    }

    private async calculateLiveCommission(event: PaymentStateTransitionEvent): Promise<void> {
        const ctx = event.ctx;
        const order = event.order;
        const roomId = (order as any).customFields?.liveRoomId;
        if (!roomId) return;

        const roomRepo = this.connection.getRepository(ctx, LiveRoom);
        const room = await roomRepo.findOne({ where: { id: String(roomId) } as any });
        if (!room?.streamerCustomerId) return;

        const distRepo = this.connection.getRepository(ctx, Distributor);
        const distributor = await distRepo
            .createQueryBuilder('d')
            .leftJoinAndSelect('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: room.streamerCustomerId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        if (!distributor || distributor.status !== 'active') return;
        if (String(distributor.customerId) === String(order.customer?.id)) return; // 自购不结算

        const rate = this.opts.liveCommissionRate ?? 1000;
        const amount = Math.floor(order.total * rate / 10000);
        if (amount <= 0) return;

        await this.connection.startTransaction(ctx);
        try {
            const channel = await this.connection.getEntityOrThrow(ctx, Channel, ctx.channelId);
            const record = new CommissionRecord({
                distributorId: String(distributor.id),
                orderId: String(order.id),
                commissionType: 'direct',
                commissionRate: rate,
                orderAmount: order.total,
                commissionAmount: amount,
                status: 'pending',
                settledAt: null,
            });
            record.channels = [channel];
            await this.connection.getRepository(ctx, CommissionRecord).save(record);
            Logger.info(`Live commission ${amount} for streamer ${room.streamerCustomerId}`, loggerCtx);
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
}