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
    UserInputError,
} from '@vendure/core';
import crypto from 'crypto';

import { loggerCtx } from './constants';
import { RechargeCard } from './recharge-card.entity';
import { RechargeCardBatch } from './recharge-card-batch.entity';
import { CustomerBalance } from './customer-balance.entity';
import { BalanceTransaction, BalanceTransactionType } from './balance-transaction.entity';

const SCRYPT_KEYLEN = 64;

function scryptDerive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}

async function hashPin(pin: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const hash = await scryptDerive(pin, salt);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
    if (!stored) return true;
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const test = await scryptDerive(pin, salt);
    if (test.length !== expected.length) return false;
    return crypto.timingSafeEqual(test, expected);
}

interface BalanceChangeMeta {
    orderId?: ID | null;
    paymentId?: ID | null;
    rechargeCardId?: ID | null;
    remark?: string | null;
}

@Injectable()
export class RechargeCardService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}

    // ===== Balance Operations =====

    /**
     * Unifies the customer identity across all balance entry points.
     * Given an explicit `customerId`, returns it directly. Otherwise resolves
     * the Customer.id from the active session's User.id via customerService.
     * This fixes the prior mix of User.id (consumption/recharge) and
     * Customer.id (refund) keys that fragmented a single account's balance.
     */
    private async resolveCustomerId(ctx: RequestContext, customerId?: any): Promise<number> {
        if (customerId !== undefined && customerId !== null) {
            return Number(customerId);
        }
        if (!ctx.activeUserId) {
            throw new UserInputError('Must be logged in');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new UserInputError('Customer not found');
        }
        return customer.id;
    }

    async getBalance(ctx: RequestContext, customerId?: any): Promise<number> {
        const cid = await this.resolveCustomerId(ctx, customerId);
        const repo = this.connection.getRepository(ctx, CustomerBalance);
        const record = await repo.findOne({
            where: { customerId: cid, channelId: ctx.channelId as any },
        });
        return record?.balance ?? 0;
    }

    async addBalance(
        ctx: RequestContext,
        customerId: any,
        amount: number,
        orderId?: ID | null,
        paymentId?: ID | null,
        type: BalanceTransactionType = BalanceTransactionType.REFUND,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('Invalid amount');
        }
        await this.connection.startTransaction(ctx);
        try {
            const result = await this.applyBalanceChange(ctx, customerId, amt, type, {
                orderId: orderId ?? null,
                paymentId: paymentId ?? null,
            });
            await this.connection.commitOpenTransaction(ctx);
            return result;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    async deductBalance(
        ctx: RequestContext,
        customerId: any,
        amount: number,
        orderId?: ID | null,
        paymentId?: ID | null,
    ): Promise<number> {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new UserInputError('Invalid amount');
        }
        await this.connection.startTransaction(ctx);
        try {
            const result = await this.applyBalanceChange(ctx, customerId, -amt, BalanceTransactionType.CONSUME, {
                orderId: orderId ?? null,
                paymentId: paymentId ?? null,
            });
            await this.connection.commitOpenTransaction(ctx);
            return result;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    // ===== Card Operations =====

    async redeemCard(ctx: RequestContext, code: string, pin?: string): Promise<RechargeCard> {
        const cid = await this.resolveCustomerId(ctx);
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { code } });
        if (!card) {
            throw new UserInputError('Invalid recharge card code');
        }
        if (card.state !== 'unused') {
            throw new UserInputError(`Card is already ${card.state}`);
        }
        if (card.expiresAt && new Date() > card.expiresAt) {
            await this.connection.startTransaction(ctx);
            try {
                await repo.createQueryBuilder()
                    .update(RechargeCard)
                    .set({ state: 'expired' })
                    .where('id = :id AND state = :state', { id: card.id, state: 'unused' })
                    .execute();
                await this.connection.commitOpenTransaction(ctx);
            } catch (e) {
                await this.connection.rollBackTransaction(ctx);
                throw e;
            }
            throw new UserInputError('Card has expired');
        }
        if (card.pinHash) {
            if (!pin || !(await verifyPin(pin, card.pinHash))) {
                throw new UserInputError('Invalid code or PIN');
            }
        }

        await this.connection.startTransaction(ctx);
        try {
            // Atomically mark card as used (prevents double-redeem under concurrency)
            const claimResult = await repo.createQueryBuilder()
                .update(RechargeCard)
                .set({
                    state: 'used',
                    redeemedByCustomerId: cid as any,
                    redeemedAt: new Date(),
                })
                .where('id = :id AND state = :state', { id: card.id, state: 'unused' })
                .execute();
            if (claimResult.affected === 0) {
                throw new UserInputError(`Card is already ${card.state}`);
            }
            // Credit balance + record transaction within the same transaction
            await this.applyBalanceChange(ctx, cid, card.faceValue, BalanceTransactionType.RECHARGE, {
                rechargeCardId: card.id,
            });
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }

        Logger.info(`Card ${code} redeemed by customer ${cid}, added ${card.faceValue} to balance`, loggerCtx);
        card.state = 'used';
        return card;
    }

    async findMyCards(ctx: RequestContext): Promise<RechargeCard[]> {
        const cid = await this.resolveCustomerId(ctx);
        const repo = this.connection.getRepository(ctx, RechargeCard);
        return repo.find({
            where: { redeemedByCustomerId: cid as any },
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
        const plaintextPins: { code: string; pin: string }[] = [];
        for (let i = 0; i < input.quantity; i++) {
            const code = `${savedBatch.prefix}${Date.now()}${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
            // 12-char hex PIN = 48 bit entropy (up from 24 bit)
            const pin = crypto.randomBytes(6).toString('hex').toUpperCase();
            const pinHash = await hashPin(pin);
            const card = new RechargeCard({
                code,
                pinHash,
                faceValue: input.faceValue,
                state: 'unused',
                batchId: savedBatch.id as any,
                expiresAt: input.expiresAt || null,
            });
            card.channels = [ctx.channel];
            cards.push(card);
            plaintextPins.push({ code, pin });
        }
        await cardRepo.save(cards);

        savedBatch.generatedCount = input.quantity;
        savedBatch.plaintextPins = plaintextPins;
        await batchRepo.save(savedBatch);

        Logger.info(`Created batch ${savedBatch.name} with ${input.quantity} cards`, loggerCtx);
        return savedBatch;
    }

    async freezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard> {
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { id: id as any } });
        if (!card) throw new UserInputError('Card not found');
        if (card.state === 'unused') {
            card.state = 'frozen';
            await repo.save(card);
        }
        return card;
    }

    async unfreezeCard(ctx: RequestContext, id: ID): Promise<RechargeCard> {
        const repo = this.connection.getRepository(ctx, RechargeCard);
        const card = await repo.findOne({ where: { id: id as any } });
        if (!card) throw new UserInputError('Card not found');
        if (card.state === 'frozen') {
            card.state = 'unused';
            await repo.save(card);
        }
        return card;
    }

    // ===== Internal helpers =====

    /**
     * Applies an atomic balance change and records a BalanceTransaction.
     * Must be called within an already-started transaction.
     * `delta` > 0 adds balance, `delta` < 0 deducts (with sufficiency check).
     * Returns the balance after the change.
     */
    private async applyBalanceChange(
        ctx: RequestContext,
        customerId: any,
        delta: number,
        type: BalanceTransactionType,
        meta: BalanceChangeMeta,
    ): Promise<number> {
        const repo = this.connection.getRepository(ctx, CustomerBalance);
        const absAmt = Math.abs(delta);
        const cid = customerId as any;
        const chid = ctx.channelId as any;

        if (delta < 0) {
            const result = await repo.createQueryBuilder()
                .update(CustomerBalance)
                .set({ balance: () => `balance - ${absAmt}` })
                .where('customerId = :cid AND channelId = :chid AND balance >= :amt', {
                    cid, chid, amt: absAmt,
                })
                .execute();
            if (result.affected === 0) {
                throw new UserInputError('Insufficient balance');
            }
        } else {
            const result = await repo.createQueryBuilder()
                .update(CustomerBalance)
                .set({ balance: () => `balance + ${absAmt}` })
                .where('customerId = :cid AND channelId = :chid', { cid, chid })
                .execute();
            if (result.affected === 0) {
                // Balance row does not exist yet; create it. A concurrent insert
                // would fail on the (customer, channel) unique constraint, in which
                // case we fall back to a second atomic update.
                try {
                    await repo.save(new CustomerBalance({
                        customerId: cid,
                        channelId: chid,
                        balance: absAmt,
                    }));
                } catch (e) {
                    await repo.createQueryBuilder()
                        .update(CustomerBalance)
                        .set({ balance: () => `balance + ${absAmt}` })
                        .where('customerId = :cid AND channelId = :chid', { cid, chid })
                        .execute();
                }
            }
        }

        const record = await repo.findOne({ where: { customerId: cid, channelId: chid } });
        const balanceAfter = record?.balance ?? 0;
        const balanceBefore = balanceAfter - delta;

        await this.connection.getRepository(ctx, BalanceTransaction).save(new BalanceTransaction({
            customerId: cid,
            type,
            amount: delta,
            balanceBefore,
            balanceAfter,
            orderId: meta.orderId as any,
            paymentId: meta.paymentId as any,
            rechargeCardId: meta.rechargeCardId as any,
            remark: meta.remark ?? null,
        }));

        return balanceAfter;
    }
}
