import { Inject, Injectable } from '@nestjs/common';
import {
    ChannelService,
    Customer,
    Logger,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { WechatInboundMessage, WechatMessageEvent } from '@vendure/wechat-auth-plugin';

import {
    buildBindGuideText,
    buildGuideText,
    buildInvalidOrderText,
    buildNewsMessage,
    buildNoResultText,
    buildOrderFailText,
    buildOrderSuccessText,
    buildOutOfStockText,
    buildSearchErrorText,
    buildSessionExpiredText,
    buildTextListMessage,
    buildWelcomeText,
} from './card-builder';
import { loggerCtx, WECHAT_ASSISTANT_PLUGIN_OPTIONS } from './constants';
import { CredentialService } from './credential.service';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { buildDedupKey, recognizeIntent } from './intent';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { WechatCredentials, WechatShoppingAssistantOptions } from './types';
import { WechatSender } from './wechat-sender';

/**
 * 微信购物助手编排器：
 * 回调事件（WechatMessageEvent）→ 去重 → 意图识别 → 搜索/下单 → 客服消息回复。
 * 全链路异步执行且吞掉异常（回调 5 秒内已回 success，超时微信会重试，
 * 重复推送由 MsgId 去重表挡住）。
 */
@Injectable()
export class AssistantService {
    constructor(
        @Inject(WECHAT_ASSISTANT_PLUGIN_OPTIONS) private opts: WechatShoppingAssistantOptions,
        private connection: TransactionalConnection,
        private sessionService: SessionService,
        private searchService: AssistantSearchService,
        private orderService: AssistantOrderService,
        private sender: WechatSender,
        private credentialService: CredentialService,
        private channelService: ChannelService,
        private requestContextService: RequestContextService,
    ) {}

    async onMessage(event: WechatMessageEvent): Promise<void> {
        const msg = event.message;
        try {
            await this.handle(msg);
        } catch (e) {
            Logger.error(`Assistant handle message failed: ${String(e)}`, loggerCtx);
        }
    }

    private async handle(msg: WechatInboundMessage): Promise<void> {
        if (!(await this.claimDedup(msg))) return;

        const credentials = await this.credentialService.resolveForChannel(msg.channelToken, {});

        // 关注事件：欢迎语；其余非文本消息忽略（P0 只处理文本）
        if (msg.msgType === 'event') {
            if (msg.event === 'subscribe') {
                await this.reply(msg, buildWelcomeText(msg.fromUserName), credentials);
            }
            return;
        }
        if (msg.msgType !== 'text' || !msg.content) return;

        const intent = recognizeIntent(msg.content);
        Logger.info(`Assistant intent=${intent.kind} from=${msg.fromUserName}`, loggerCtx);

        switch (intent.kind) {
            case 'help':
                await this.reply(msg, buildGuideText(msg.fromUserName, this.storefront()), credentials);
                return;
            case 'bind':
                await this.reply(msg, buildBindGuideText(msg.fromUserName, this.loginUrl()), credentials);
                return;
            case 'search':
                await this.handleSearch(msg, intent.query, intent.quantity ?? 1, credentials);
                return;
            case 'order':
                await this.handleOrder(msg, intent.indices, credentials);
                return;
        }
    }

    // ============ 搜索：meili 检索 → 会话保存 → 卡片回复 ============

    private async handleSearch(
        msg: WechatInboundMessage,
        query: string,
        quantity: number,
        credentials: WechatCredentials,
    ): Promise<void> {
        const channelId = await this.resolveChannelId(msg.channelToken);
        let products;
        try {
            products = await this.searchService.searchProducts({
                query,
                channelId,
                locale: this.opts.searchLocale ?? 'zh',
                limit: this.opts.searchLimit ?? 5,
                storefrontUrl: this.storefront(),
            });
        } catch (e) {
            Logger.error(`Assistant search failed: ${String(e)}`, loggerCtx);
            await this.reply(msg, buildSearchErrorText(msg.fromUserName), credentials);
            return;
        }
        if (!products.length) {
            await this.reply(msg, buildNoResultText(msg.fromUserName, query), credentials);
            return;
        }
        // 数量进会话：编号下单时按该数量加购
        const results = products.map(p => ({ ...p, quantity }));
        await this.sessionService.saveResults(
            msg.fromUserName,
            channelId,
            results,
            query,
            this.opts.sessionTtlMinutes ?? 30,
        );
        const news = buildNewsMessage(msg.fromUserName, results);
        if (news) {
            // 方案 A（图文卡片）失败自动降级方案 B（纯文本编号列表）
            await this.sender.sendOrFallback(news, buildTextListMessage(msg.fromUserName, results).content, credentials);
        } else {
            await this.sender.send(buildTextListMessage(msg.fromUserName, results), credentials);
        }
    }

    // ============ 下单：编号回查会话 → 绑定校验 → 建单 → 确认通知 ============

    private async handleOrder(
        msg: WechatInboundMessage,
        indices: number[],
        credentials: WechatCredentials,
    ): Promise<void> {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (!session) {
            await this.reply(msg, buildSessionExpiredText(msg.fromUserName), credentials);
            return;
        }
        const picked = session.results.filter(r => indices.includes(r.index));
        if (!picked.length) {
            await this.reply(msg, buildInvalidOrderText(msg.fromUserName, indices), credentials);
            return;
        }

        // 身份门槛：仅已绑定微信用户（openid→Customer）可下单
        const customer = await this.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            await this.reply(msg, buildBindGuideText(msg.fromUserName, this.loginUrl()), credentials);
            return;
        }

        const ctx = await this.requestContextService.create({
            apiType: 'shop',
            channelOrToken: session.channelId as any,
        });
        const outcome = await this.orderService.createOrder(
            ctx,
            customer.id,
            picked.map(p => ({ productId: p.productId, quantity: p.quantity ?? 1 })),
        );

        switch (outcome.status) {
            case 'ok': {
                const payUrl = this.storefront()
                    ? `${this.storefront()}/checkout/confirmation/${outcome.order.code}`
                    : undefined;
                await this.reply(
                    msg,
                    buildOrderSuccessText(msg.fromUserName, {
                        orderCode: outcome.order.code,
                        total: outcome.order.totalWithTax,
                        items: outcome.items,
                        payUrl,
                    }),
                    credentials,
                );
                Logger.info(`Assistant order created: ${outcome.order.code} openid=${msg.fromUserName}`, loggerCtx);
                return;
            }
            case 'out_of_stock':
            case 'no_variant':
                await this.reply(msg, buildOutOfStockText(msg.fromUserName, outcome.title), credentials);
                return;
            default:
                await this.reply(msg, buildOrderFailText(msg.fromUserName, outcome.message), credentials);
        }
    }

    // ============ 基础设施 ============

    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    private async claimDedup(msg: WechatInboundMessage): Promise<boolean> {
        const dedupKey = buildDedupKey(msg);
        try {
            await this.connection.getRepository(WechatProcessedMessage).insert({
                dedupKey,
                receivedAt: new Date(),
            });
            return true;
        } catch {
            Logger.info(`Duplicated wechat message skipped: ${dedupKey}`, loggerCtx);
            return false;
        }
    }

    private async findCustomerByOpenid(openid: string): Promise<Customer | null> {
        const customer = await this.connection
            .getRepository(Customer)
            .findOne({ where: { customFields: { wechatOpenid: openid } } as any });
        return customer ?? null;
    }

    private async resolveChannelId(channelToken: string): Promise<string> {
        try {
            const channel = await this.channelService.findOne(RequestContext.empty(), channelToken as any);
            if (channel) return String(channel.id);
        } catch {
            // fallthrough
        }
        return '1';
    }

    private async reply(
        msg: WechatInboundMessage,
        message: { kind: string; touser: string; content?: string; articles?: any[] },
        credentials: WechatCredentials,
    ): Promise<void> {
        try {
            await this.sender.send(message as any, credentials);
        } catch (e) {
            Logger.error(`Assistant reply failed: ${String(e)}`, loggerCtx);
        }
    }

    private storefront(): string {
        return (this.opts.storefrontUrl ?? '').replace(/\/+$/, '');
    }

    private loginUrl(): string | undefined {
        return this.storefront() ? `${this.storefront()}/account/login` : undefined;
    }
}
