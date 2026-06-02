import { Injectable } from '@nestjs/common';
import { Channel, EventBus, ID, ListQueryBuilder, ListQueryOptions, Logger, PaginatedList, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';

import { CommissionRecord } from './commission-record.entity';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';
import { loggerCtx } from './constants';

@Injectable()
export class CommissionService {
    private initialized = false;

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private distributionService: DistributionService,
        private eventBus: EventBus,
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;

        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === 'Settled') {
                try {
                    await this.calculateCommission(event);
                } catch (e: any) {
                    Logger.error(`Failed to calculate commission for order ${event.order.id}: ${e.message}`, loggerCtx);
                }
            }
        });
    }

    async calculateCommission(event: PaymentStateTransitionEvent): Promise<void> {
        const ctx = event.ctx;
        const order = event.order;

        if (!(ctx.channel as any).customFields?.distributionEnabled) {
            return;
        }

        const customer = order.customer;
        if (!customer) return;

        const referralCode = (customer as any).customFields?.referralCode;
        if (!referralCode) return;

        const directDistributor = await this.distributionService.findByReferralCode(ctx, referralCode);
        if (!directDistributor || directDistributor.status !== 'active') return;

        const directRate = (ctx.channel as any).customFields?.directCommissionRate ?? 1000;
        const orderTotal = order.total;

        const directAmount = Math.floor(orderTotal * directRate / 10000);

        const channel = await this.connection.getEntityOrThrow(ctx, Channel, ctx.channelId);

        const directRecord = new CommissionRecord({
            distributorId: String(directDistributor.id),
            orderId: String(order.id),
            commissionType: 'direct',
            commissionRate: directRate,
            orderAmount: orderTotal,
            commissionAmount: directAmount,
            status: 'pending',
            settledAt: null,
        });
        directRecord.channels = [channel];
        await this.connection.getRepository(ctx, CommissionRecord).save(directRecord);

        Logger.info(`Created direct commission ${directAmount} for distributor ${directDistributor.id}`, loggerCtx);

        if (directDistributor.parentId) {
            const indirectRate = (ctx.channel as any).customFields?.indirectCommissionRate ?? 500;
            const indirectAmount = Math.floor(orderTotal * indirectRate / 10000);

            const indirectRecord = new CommissionRecord({
                distributorId: String(directDistributor.parentId),
                orderId: String(order.id),
                fromDistributorId: String(directDistributor.id),
                commissionType: 'indirect',
                commissionRate: indirectRate,
                orderAmount: orderTotal,
                commissionAmount: indirectAmount,
                status: 'pending',
                settledAt: null,
            });
            indirectRecord.channels = [channel];
            await this.connection.getRepository(ctx, CommissionRecord).save(indirectRecord);

            Logger.info(`Created indirect commission ${indirectAmount} for distributor ${directDistributor.parentId}`, loggerCtx);
        }
    }

    findAll(ctx: RequestContext, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>> {
        return this.listQueryBuilder
            .build(CommissionRecord, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    findByDistributor(ctx: RequestContext, distributorId: ID, options?: ListQueryOptions<CommissionRecord>): Promise<PaginatedList<CommissionRecord>> {
        return this.listQueryBuilder
            .build(CommissionRecord, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['channels'],
                where: { distributorId } as any,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async settlePendingCommissions(ctx: RequestContext): Promise<number> {
        const settlementDays = (ctx.channel as any).customFields?.commissionSettlementDays ?? 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - settlementDays);

        const repo = this.connection.getRepository(ctx, CommissionRecord);
        const pendingRecords = await repo
            .createQueryBuilder('record')
            .leftJoinAndSelect('record.channels', 'channel')
            .where('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('record.status = :status', { status: 'pending' })
            .andWhere('record.createdAt <= :cutoffDate', { cutoffDate })
            .getMany();

        let settledCount = 0;
        for (const record of pendingRecords) {
            record.status = 'confirmed';
            record.settledAt = new Date();
            await repo.save(record);

            const distributor = await this.connection.getEntityOrThrow(ctx, Distributor, record.distributorId);
            distributor.availableBalance += record.commissionAmount;
            distributor.totalEarnings += record.commissionAmount;
            await this.connection.getRepository(ctx, Distributor).save(distributor);

            settledCount++;
        }

        if (settledCount > 0) {
            Logger.info(`Settled ${settledCount} pending commissions`, loggerCtx);
        }

        return settledCount;
    }
}
