import { Injectable } from '@nestjs/common';
import { Channel, CustomerService, EventBus, ID, ListQueryBuilder, ListQueryOptions, Logger, OrderService, PaginatedList, PaymentStateTransitionEvent, RequestContext, RefundStateTransitionEvent, TransactionalConnection } from '@vendure/core';

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
        private customerService: CustomerService,
        private orderService: OrderService,
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

        this.eventBus.ofType(RefundStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === 'Settled') {
                try {
                    await this.cancelCommissionByOrder(event.ctx, String(event.order.id));
                } catch (e: any) {
                    Logger.error(`Failed to cancel commission for order ${event.order.id} on refund: ${e.message}`, loggerCtx);
                }
            }
        });
    }

    async calculateCommission(event: PaymentStateTransitionEvent): Promise<void> {
        const ctx = event.ctx;
        const rawOrder = event.order;

        if (!(ctx.channel as any).customFields?.distributionEnabled) {
            return;
        }

        // 事件携带的 order 不保证已加载 customer 及其 customFields（支付/退款事件 order.customer 为空是常见坑），按 id 重载。
        const order = (await this.orderService.findOne(ctx, rawOrder.id as ID, ['customer'])) ?? rawOrder;
        const customerId = rawOrder.customerId != null ? rawOrder.customerId : (order as any)?.customer?.id;
        if (!customerId) return;

        const customer = (await this.customerService.findOne(ctx, customerId as ID)) ?? (order as any)?.customer;
        if (!customer) return;

        // 修复：读取 referredBy（推荐人的推荐码），而非 referralCode（自己的码）
        const referredBy = (customer as any).customFields?.referredBy;
        if (!referredBy) return;

        const directDistributor = await this.distributionService.findByReferralCode(ctx, referredBy);
        if (!directDistributor || directDistributor.status !== 'active') return;

        // self-referral 校验：订单用户不能是分销商自己
        if (String(directDistributor.customerId) === String(customer.id)) {
            Logger.info(`Skip self-referral commission for customer ${customer.id}`, loggerCtx);
            return;
        }

        const directRate = (ctx.channel as any).customFields?.directCommissionRate ?? 1000;
        // 佣金基数 = 扣券后实际应付（含税金额），与阶段37券体系一致：券不影响佣金率，只影响应付额。
        const orderTotal = order.totalWithTax ?? rawOrder.totalWithTax ?? 0;

        const directAmount = Math.floor(orderTotal * directRate / 10000);

        // 事务包装：保证多条 CommissionRecord 原子写入
        await this.connection.startTransaction(ctx);
        try {
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

            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
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

    /**
     * 退款冲销：反查 orderId 对应的 CommissionRecord，pending/confirmed 置 cancelled；
     * 已 confirmed 的还需扣回 distributor.availableBalance。
     */
    async cancelCommissionByOrder(ctx: RequestContext, orderId: string): Promise<number> {
        const repo = this.connection.getRepository(ctx, CommissionRecord);
        const records = await repo.find({ where: { orderId } as any });

        let cancelledCount = 0;
        for (const record of records) {
            if (record.status !== 'pending' && record.status !== 'confirmed') {
                continue;
            }
            const wasConfirmed = record.status === 'confirmed';
            record.status = 'cancelled';
            await repo.save(record);

            if (wasConfirmed) {
                const distributor = await this.connection.getEntityOrThrow(ctx, Distributor, record.distributorId);
                distributor.availableBalance -= record.commissionAmount;
                if (distributor.availableBalance < 0) {
                    distributor.availableBalance = 0;
                }
                await this.connection.getRepository(ctx, Distributor).save(distributor);
            }

            cancelledCount++;
        }

        if (cancelledCount > 0) {
            Logger.info(`Cancelled ${cancelledCount} commission records for order ${orderId}`, loggerCtx);
        }

        return cancelledCount;
    }
}
