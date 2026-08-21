import { Injectable } from '@nestjs/common';
import { Channel, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { LiveRoom } from './live-room.entity';
import { LiveRoomProduct } from './live-room-product.entity';
import { LiveStreamingPluginOptions } from './types';

function randomKey(len: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
}

@Injectable()
export class LiveRoomService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    private opts: LiveStreamingPluginOptions = {};
    setOptions(opts: LiveStreamingPluginOptions): void { this.opts = opts; }

    findAll(ctx: RequestContext, options?: ListQueryOptions<LiveRoom>): Promise<PaginatedList<LiveRoom>> {
        return this.listQueryBuilder
            .build(LiveRoom, options, { ctx, channelId: ctx.channelId, relations: ['products'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<LiveRoom | undefined> {
        return this.connection
            .findOneInChannel(ctx, LiveRoom, id, ctx.channelId, { relations: ['products'] })
            .then(r => r ?? undefined);
    }

    async create(ctx: RequestContext, input: any): Promise<LiveRoom> {
        const room = new LiveRoom({
            name: input.name,
            coverUrl: input.coverUrl ?? null,
            description: input.description ?? null,
            streamerCustomerId: input.streamerCustomerId ?? null,
            streamerName: input.streamerName ?? null,
            type: input.type ?? 'product',
            status: 'scheduled',
            scheduledStartAt: input.scheduledStartAt ? new Date(input.scheduledStartAt) : null,
            streamKey: null,
            playUrl: null,
            replayUrl: null,
            likeCount: 0,
            viewCount: 0,
        });
        room.channels = [await this.connection.getEntityOrThrow(ctx, Channel, ctx.channelId)];
        return this.connection.getRepository(ctx, LiveRoom).save(room);
    }

    async update(ctx: RequestContext, input: any): Promise<LiveRoom> {
        const room = await this.findOne(ctx, input.id);
        if (!room) throw new UserInputError('Live room not found');
        if (input.name != null) room.name = input.name;
        if (input.coverUrl !== undefined) room.coverUrl = input.coverUrl;
        if (input.description !== undefined) room.description = input.description;
        if (input.streamerCustomerId !== undefined) room.streamerCustomerId = input.streamerCustomerId;
        if (input.streamerName !== undefined) room.streamerName = input.streamerName;
        if (input.type !== undefined) room.type = input.type;
        if (input.scheduledStartAt !== undefined) room.scheduledStartAt = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
        return this.connection.getRepository(ctx, LiveRoom).save(room);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const room = await this.findOne(ctx, id);
        if (!room) throw new UserInputError('Live room not found');
        await this.connection.getRepository(ctx, LiveRoomProduct)
            .createQueryBuilder('p')
            .delete()
            .where('id IN (:...ids)', { ids: room.products.map(p => p.id) })
            .execute().catch(() => undefined);
        await this.connection.getRepository(ctx, LiveRoom).remove(room);
        return true;
    }

    /** 开播：生成推拉流地址，状态置 live */
    async start(ctx: RequestContext, id: ID): Promise<LiveRoom> {
        const room = await this.findOne(ctx, id);
        if (!room) throw new UserInputError('Live room not found');
        if (!room.streamKey) {
            room.streamKey = randomKey(this.opts.streamKeyLength ?? 16);
        }
        room.playUrl = `${this.opts.playDomain ?? ''}${room.streamKey}.m3u8`;
        room.status = 'live';
        room.startedAt = new Date();
        return this.connection.getRepository(ctx, LiveRoom).save(room);
    }

    /** 关播：可设置回放 */
    async stop(ctx: RequestContext, id: ID, replayUrl?: string): Promise<LiveRoom> {
        const room = await this.findOne(ctx, id);
        if (!room) throw new UserInputError('Live room not found');
        room.status = 'ended';
        room.endedAt = new Date();
        if (replayUrl) room.replayUrl = replayUrl;
        return this.connection.getRepository(ctx, LiveRoom).save(room);
    }

    /** 推流地址（主播端，含密钥） */
    pushUrlOf(room: LiveRoom): string | null {
        if (!room.streamKey) return null;
        return `${this.opts.pushDomain ?? ''}${room.streamKey}`;
    }

    /** 挂载商品到直播间 */
    async addProduct(ctx: RequestContext, roomId: ID, input: any): Promise<LiveRoom> {
        const room = await this.findOne(ctx, roomId);
        if (!room) throw new UserInputError('Live room not found');
        const product = new LiveRoomProduct({
            variantId: String(input.variantId),
            name: input.name,
            price: input.price,
            imageUrl: input.imageUrl ?? null,
            sortOrder: input.sortOrder ?? 0,
        });
        product.channels = [await this.connection.getEntityOrThrow(ctx, Channel, ctx.channelId)];
        const saved = await this.connection.getRepository(ctx, LiveRoomProduct).save(product);
        const repo = this.connection.getRepository(ctx, LiveRoom);
        const current = await repo.findOne({ where: { id: roomId as any }, relations: ['products'] });
        current!.products = [...(current!.products ?? []), saved];
        return repo.save(current!);
    }

    /** 移除直播间商品 */
    async removeProduct(ctx: RequestContext, roomId: ID, productId: ID): Promise<LiveRoom> {
        const repo = this.connection.getRepository(ctx, LiveRoom);
        const current = await repo.findOne({ where: { id: roomId as any }, relations: ['products'] });
        if (!current) throw new UserInputError('Live room not found');
        current.products = (current.products ?? []).filter(p => String(p.id) !== String(productId));
        await this.connection.getRepository(ctx, LiveRoomProduct).delete(productId as any).catch(() => undefined);
        return repo.save(current);
    }
}
