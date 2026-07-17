import { Inject, Injectable } from '@nestjs/common';
import {
    Customer,
    Fulfillment,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    Order,
    PaginatedList,
    Refund,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx, SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS, WECHAT_MESSAGE_PROVIDER } from './constants';
import { SubscribeMessageLog } from './subscribe-message-log.entity';
import {
    SendSubscribeMessageInput,
    WechatMessageProvider,
} from './wechat-message-provider';
import { WechatSubscribeMessagePluginOptions } from './types';

export interface SubscribeMessageLogListOptions extends ListQueryOptions<SubscribeMessageLog> {
    customerId?: ID;
    status?: string;
}

@Injectable()
export class SubscribeMessageService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        @Inject(WECHAT_MESSAGE_PROVIDER) private provider: WechatMessageProvider,
        @Inject(SUBSCRIBE_MESSAGE_PLUGIN_OPTIONS) private options: WechatSubscribeMessagePluginOptions,
    ) {}

    // ===== 业务入口 =====

    async sendOrderPaidMessage(ctx: RequestContext, order: Order): Promise<void> {
        const templateId = this.getChannelTemplateId(ctx, 'orderPaidTemplateId');
        if (!templateId) {
            Logger.debug(`Channel ${ctx.channelId} has no orderPaidTemplateId, skip`, loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            totalAmount: { value: this.formatMoney(order.total, ctx) },
            paidAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }

    async sendOrderShippedMessage(
        ctx: RequestContext,
        order: Order,
        fulfillment?: Fulfillment,
    ): Promise<void> {
        const templateId = this.getChannelTemplateId(ctx, 'orderShippedTemplateId');
        if (!templateId) {
            Logger.debug(`Channel ${ctx.channelId} has no orderShippedTemplateId, skip`, loggerCtx);
            return;
        }
        const f = fulfillment ?? (await this.getLatestFulfillment(ctx, order));
        const data = {
            orderNo: { value: String(order.code) },
            carrier: { value: f?.method ?? '' },
            trackingNo: { value: f?.trackingCode ?? '' },
            shippedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }

    async sendOrderDeliveredMessage(ctx: RequestContext, order: Order): Promise<void> {
        const templateId = this.getChannelTemplateId(ctx, 'orderDeliveredTemplateId');
        if (!templateId) {
            Logger.debug(`Channel ${ctx.channelId} has no orderDeliveredTemplateId, skip`, loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            signedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }

    async sendOrderRefundedMessage(
        ctx: RequestContext,
        order: Order,
        refund: Refund,
    ): Promise<void> {
        const templateId = this.getChannelTemplateId(ctx, 'orderRefundedTemplateId');
        if (!templateId) {
            Logger.debug(`Channel ${ctx.channelId} has no orderRefundedTemplateId, skip`, loggerCtx);
            return;
        }
        const data = {
            orderNo: { value: String(order.code) },
            refundAmount: { value: this.formatMoney(refund.total, ctx) },
            refundedAt: { value: this.formatDate(new Date()) },
        };
        await this.dispatchForOrder(ctx, order, templateId, data);
    }

    async sendCustomMessage(
        ctx: RequestContext,
        customerId: ID,
        templateId: string,
        data: Record<string, { value: string; color?: string }>,
        page?: string,
    ): Promise<SubscribeMessageLog> {
        const openid = await this.getOpenidByCustomer(ctx, customerId);
        if (!openid) {
            Logger.warn(`Customer ${customerId} has no wechat openid, skip`, loggerCtx);
            throw new Error(`Customer ${customerId} has no wechat openid`);
        }
        return this.sendAndLog(ctx, Number(customerId), openid, templateId, data, page);
    }

    // ===== Admin 查询 =====

    async getSendLogs(
        ctx: RequestContext,
        options?: SubscribeMessageLogListOptions,
    ): Promise<PaginatedList<SubscribeMessageLog>> {
        return this.listQueryBuilder
            .build(SubscribeMessageLog, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    // ===== 内部实现 =====

    private async dispatchForOrder(
        ctx: RequestContext,
        order: Order,
        templateId: string,
        data: Record<string, { value: string; color?: string }>,
    ): Promise<void> {
        const customer = order.customer;
        if (!customer) {
            Logger.debug(`Order ${order.code} has no customer, skip subscribe message`, loggerCtx);
            return;
        }
        const openid = this.readCustomerOpenid(customer);
        if (!openid) {
            Logger.debug(
                `Customer ${customer.id} of order ${order.code} has no wechat openid, skip`,
                loggerCtx,
            );
            return;
        }
        try {
            await this.sendAndLog(ctx, Number(customer.id), openid, templateId, data, this.resolvePage(ctx));
        } catch (e: any) {
            Logger.error(
                `Failed to send subscribe message for order ${order.code}: ${e?.message ?? e}`,
                loggerCtx,
            );
        }
    }

    private async sendAndLog(
        ctx: RequestContext,
        customerId: number,
        openid: string,
        templateId: string,
        data: Record<string, { value: string; color?: string }>,
        page?: string,
    ): Promise<SubscribeMessageLog> {
        const miniprogramState = this.resolveMiniprogramState(ctx);
        const log = new SubscribeMessageLog({
            customerId,
            openid,
            templateId,
            data,
            status: 'pending',
            page: page ?? null,
            miniprogramState: miniprogramState ?? null,
        });
        log.channels = [ctx.channel];
        await this.connection.getRepository(ctx, SubscribeMessageLog).save(log);

        const input: SendSubscribeMessageInput = {
            openid,
            templateId,
            data,
            page: page ?? undefined,
            miniprogramState: miniprogramState ?? undefined,
        };
        const result = await this.provider.sendSubscribeMessage(ctx, input);

        log.status = result.success ? 'sent' : 'failed';
        log.msgId = result.msgId ?? null;
        log.errorMsg = result.error ?? null;
        log.sentAt = result.success ? new Date() : undefined;
        await this.connection.getRepository(ctx, SubscribeMessageLog).save(log);

        if (!result.success) {
            Logger.warn(
                `Subscribe message to customer ${customerId} (template ${templateId}) failed: ${result.error}`,
                loggerCtx,
            );
        } else {
            Logger.info(
                `Subscribe message sent to customer ${customerId} (msgid=${result.msgId})`,
                loggerCtx,
            );
        }
        return log;
    }

    private async getLatestFulfillment(
        ctx: RequestContext,
        order: Order,
    ): Promise<Fulfillment | null> {
        return this.connection
            .getRepository(ctx, Fulfillment)
            .createQueryBuilder('f')
            .innerJoin('f.orders', 'order', 'order.id = :orderId', { orderId: order.id })
            .orderBy('f.createdAt', 'DESC')
            .getOne();
    }

    private async getOpenidByCustomer(
        ctx: RequestContext,
        customerId: ID,
    ): Promise<string | null> {
        const customer = await this.connection
            .getEntityOrThrow(ctx, Customer, customerId)
            .catch(() => null);
        if (!customer) return null;
        return this.readCustomerOpenid(customer);
    }

    private readCustomerOpenid(customer: any): string | null {
        const cf = customer?.customFields ?? {};
        return cf.wechatMiniOpenid || cf.wechatOpenid || null;
    }

    private getChannelTemplateId(
        ctx: RequestContext,
        field: string,
    ): string | null {
        const cf = (ctx.channel as any)?.customFields ?? {};
        return cf[field] ?? null;
    }

    private resolvePage(ctx: RequestContext): string | undefined {
        const cf = (ctx.channel as any)?.customFields ?? {};
        return cf.subscribeMessagePage ?? this.options.defaultPage ?? undefined;
    }

    private resolveMiniprogramState(ctx: RequestContext): string | undefined {
        const cf = (ctx.channel as any)?.customFields ?? {};
        return (
            cf.subscribeMessageMiniprogramState ??
            this.options.defaultMiniprogramState ??
            'formal'
        );
    }

    private formatMoney(amount: number | undefined | null, ctx: RequestContext): string {
        const value = (amount ?? 0) / 100;
        const currency = ctx.currencyCode ?? 'CNY';
        const symbol = currency === 'CNY' ? '¥' : '';
        return `${symbol}${value.toFixed(2)}`;
    }

    private formatDate(date: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
}
