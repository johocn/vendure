import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ID,
    Logger,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import crypto from 'crypto';

import { loggerCtx } from './constants';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { CustomerBalance } from './customer-balance.entity';

@Injectable()
export class RechargeCardService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    // ===== Balance Operations =====

    async getBalance(ctx: RequestContext): Promise<number> {
        if (!ctx.activeUserId) return 0;
        const repo = this.connection.getRepository(ctx, CustomerBalance);
        const record = await repo.findOne({
            where: { customerId: ctx.activeUserId as any, channelId: ctx.channelId as any },
        });
        return record?.balance ?? 0;
    }

    async addBalance(ctx: RequestContext, customerId: any, amount: number): Promise<number> {
        const repo = this.connection.getRepository(ctx, CustomerBalance);
        let record = await repo.findOne({
            where: { customerId: customerId as any, channelId: ctx.channelId as any },
        });
        if (!record) {
            record = new CustomerBalance({
                customerId: customerId as any,
                channelId: ctx.channelId as any,
                balance: 0,
            });
        }
        record.balance += amount;
        await repo.save(record);
        return record.balance;
    }

    async deductBalance(ctx: RequestContext, customerId: any, amount: number): Promise<{ success: boolean; balance: number }> {
        const repo = this.connection.getRepository(ctx, CustomerBalance);
        const record = await repo.findOne({
            where: { customerId: customerId as any, channelId: ctx.channelId as any },
        });
        if (!record || record.balance < amount) {
            return { success: false, balance: record?.balance ?? 0 };
        }
        record.balance -= amount;
        await repo.save(record);
        return { success: true, balance: record.balance };
    }

    // ===== Card Operations =====

    async redeemCard(ctx: RequestContext, code: string, pin?: string): Promise<RechargeCard> {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to redeem a recharge card');
        }
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { code } });
        if (!card) {
            throw new Error('Invalid recharge card code');
        }
        if (card.state !== 'unused') {
            throw new Error(`Card is already ${card.state}`);
        }
        if (card.expiresAt && new Date() > card.expiresAt) {
            card.state = 'expired';
            await repo.save(card);
            throw new Error('Card has expired');
        }
        if (card.pin && pin !== card.pin) {
            throw new Error('Invalid PIN');
        }

        card.state = 'used';
        card.redeemedByCustomerId = ctx.activeUserId as any;
        card.redeemedAt = new Date();
        await repo.save(card);

        await this.addBalance(ctx, ctx.activeUserId, card.faceValue);
        Logger.info(`Card ${code} redeemed by customer ${ctx.activeUserId}, added ${card.faceValue} to balance`, loggerCtx);
        return card;
    }

    async findMyCards(ctx: RequestContext): Promise<RechargeCard[]> {
        if (!ctx.activeUserId) return [];
        const repo = this.connection.getRepository(ctx, RechargeCard);
        return repo.find({
            where: { redeemedByCustomerId: ctx.activeUserId as any },
            order: { createdAt: 'DESC' },
        });
    }

    // ===== Admin Operations =====

    async findAll(ctx: RequestContext, options?: ListQueryOptions<RechargeCard>): Promise<PaginatedList<RechargeCard>> {
        return this.listQueryBuilder
            .build(RechargeCard, options, { ctx, relations: ['channels'], channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findAllBatches(ctx: RequestContext, options?: ListQueryOptions<RechargeCardBatch>): Promise<PaginatedList<RechargeCardBatch>> {
        return this.listQueryBuilder
            .build(RechargeCardBatch, options, { ctx, relations: ['channels'], channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async createBatch(ctx: RequestContext, input: {
        name: string;
        prefix?: string;
        faceValue: number;
        quantity: number;
        expiresAt?: Date;
    }): Promise<RechargeCardBatch> {
        const batchRepo = this.connection.getRepository(ctx, RechargeCardBatch);
        const cardRepo = this.connection.getRepository(ctx, RechargeCard);

        const batch = new RechargeCardBatch({
            name: input.name,
            prefix: input.prefix || 'RC',
            faceValue: input.faceValue,
            quantity: input.quantity,
            expiresAt: input.expiresAt || null,
        });
        batch.channels = [ctx.channel];
        const savedBatch = await batchRepo.save(batch);

        const cards: RechargeCard[] = [];
        for (let i = 0; i < input.quantity; i++) {
            const code = `${savedBatch.prefix}${Date.now()}${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
            const pin = crypto.randomBytes(3).toString('hex').toUpperCase();
            const card = new RechargeCard({
                code,
                pin,
                faceValue: input.faceValue,
                state: 'unused',
                batchId: savedBatch.id as any,
                expiresAt: input.expiresAt || null,
            });
            card.channels = [ctx.channel];
            cards.push(card);
        }
        await cardRepo.save(cards);

        savedBatch.generatedCount = input.quantity;
        await batchRepo.save(savedBatch);

        Logger.info(`Created batch ${savedBatch.name} with ${input.quantity} cards`, loggerCtx);
        return savedBatch;
    }

    async freezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard> {
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { id: id as any } });
        if (!card) throw new Error('Card not found');
        if (card.state === 'unused') {
            card.state = 'frozen';
            await repo.save(card);
        }
        return card;
    }

    async unfreezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard> {
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { id: id as any } });
        if (!card) throw new Error('Card not found');
        if (card.state === 'frozen') {
            card.state = 'unused';
            await repo.save(card);
        }
        return card;
    }
}
