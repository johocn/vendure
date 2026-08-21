import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { LiveRoom } from './live-room.entity';
import { LiveStreamingPluginOptions } from './types';

@Injectable()
export class LiveRoomShopService {
    constructor(private connection: TransactionalConnection) {}

    private opts: LiveStreamingPluginOptions = {};
    setOptions(opts: LiveStreamingPluginOptions): void { this.opts = opts; }

    /** 列表：进行中 + 预告 + 回放（status 过滤） */
    async list(ctx: RequestContext, status?: string): Promise<LiveRoom[]> {
        const repo = this.connection.getRepository(ctx, LiveRoom);
        const qb = repo
            .createQueryBuilder('room')
            .leftJoinAndSelect('room.channels', 'channel')
            .leftJoinAndSelect('room.products', 'products')
            .where('channel.id = :channelId', { channelId: ctx.channelId });
        if (status === 'live') qb.andWhere('room.status = :s', { s: 'live' });
        else if (status === 'upcoming') qb.andWhere('room.status = :s', { s: 'scheduled' });
        else if (status === 'replay') qb.andWhere('room.status = :s', { s: 'ended' });
        qb.orderBy('room.scheduledStartAt', 'DESC');
        return qb.getMany();
    }

    async detail(ctx: RequestContext, id: ID): Promise<LiveRoom> {
        const room = await this.connection
            .findOneInChannel(ctx, LiveRoom, id, ctx.channelId, { relations: ['products'] })
            .then(r => r ?? undefined);
        if (!room) throw new UserInputError('Live room not found');
        room.viewCount += 1;
        await this.connection.getRepository(ctx, LiveRoom).save(room);
        return room;
    }

    /** 进房：返回播放/推流地址与 wsTicket（HMAC 签名，ws 服务校验） */
    enterForRoom(
        room: LiveRoom,
        customerId: ID | undefined,
        wsUrl: string | undefined,
        wsSecret: string | undefined,
    ): { roomId: string; playUrl: string | null; pushUrl: string | null; wsUrl: string; wsTicket: string } {
        const payload = `${room.id}.${customerId ?? 'guest'}.${Date.now()}`;
        const ticket = wsSecret
            ? createHmac('sha256', wsSecret).update(payload).digest('hex') + ':' + payload
            : payload;
        return {
            roomId: String(room.id),
            playUrl: room.status === 'live' ? room.playUrl : null,
            pushUrl: room.status === 'live' ? `${this.opts.pushDomain ?? ''}${room.streamKey}` : null,
            wsUrl: wsUrl ?? 'ws://localhost:3003',
            wsTicket: ticket,
        };
    }

    async listProducts(ctx: RequestContext, id: ID): Promise<LiveRoom['products']> {
        const room = await this.detail(ctx, id);
        return room.products ?? [];
    }
}
