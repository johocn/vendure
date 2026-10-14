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
import { OutboundMessage, WechatCredentials, WechatShoppingAssistantOptions } from './types';
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

    /** 事件总线链路（本插件回调直连微信时用）：去重 → 决策 → 客服消息发送 */
    private async handle(msg: WechatInboundMessage): Promise<void> {
        if (!(await this.claimDedup(msg))) return;
        const out = await this.processMessage(msg);
        if (!out) return;
        const credentials = await this.credentialService.resolveForChannel(msg.channelToken, {});
        try {
            await this.sender.send(out as any, credentials);
        } catch (e) {
            Logger.error(`Assistant reply failed: ${String(e)}`, loggerCtx);
        }
    }

    /**
     * 纯决策：意图识别 → 搜索/下单 → 组装出站消息（**不发送**）。
     * 两条链路共用：
     * ① 微信事件总线（本插件回调直连，handle() 负责发送）
     * ② HTTP 接口（strapi zhao-sso 回调转调 POST /wechat-assistant/handle，
     *    回复由 sso 的被动回复 XML 承担——受 5 秒窗口约束，本方法须快速返回）。
     * 返回 null = 无需回复（重复消息 / 非文本 / 未识别事件）。
     */
    async processMessage(msg: WechatInboundMessage): Promise<OutboundMessage | null> {
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? buildWelcomeText(msg.fromUserName) : null;
        }
        if (msg.msgType !== 'text' || !msg.content) return null;

        const intent = recognizeIntent(msg.content);
        Logger.info(`Assistant intent=${intent.kind} from=${msg.fromUserName}`, loggerCtx);

        switch (intent.kind) {
            case 'help':
                return buildGuideText(msg.fromUserName, this.storefront());
            case 'bind':
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            case 'search':
                return this.handleSearch(msg, intent.query, intent.quantity ?? 1);
            case 'order':
                return this.handleOrder(msg, intent.indices);
        }
        return null;
    }

    // ============ 搜索：meili 检索 → 会话保存 → 卡片消息 ============

    private async handleSearch(
        msg: WechatInboundMessage,
        query: string,
        quantity: number,
    ): Promise<OutboundMessage | null> {
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
            return buildSearchErrorText(msg.fromUserName);
        }
        if (!products.length) {
            return buildNoResultText(msg.fromUserName, query);
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
        return buildNewsMessage(msg.fromUserName, results) ?? buildTextListMessage(msg.fromUserName, results);
    }

    // ============ 下单：编号回查会话 → 绑定校验 → 建单 → 确认通知 ============

    private async handleOrder(
        msg: WechatInboundMessage,
        indices: number[],
    ): Promise<OutboundMessage | null> {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (!session) {
            return buildSessionExpiredText(msg.fromUserName);
        }
        const picked = session.results.filter(r => indices.includes(r.index));
        if (!picked.length) {
            return buildInvalidOrderText(msg.fromUserName, indices);
        }

        // 身份门槛：仅已绑定微信用户（openid→Customer）可下单
        const customer = await this.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            return buildBindGuideText(msg.fromUserName, this.loginUrl());
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
                Logger.info(`Assistant order created: ${outcome.order.code} openid=${msg.fromUserName}`, loggerCtx);
                return buildOrderSuccessText(msg.fromUserName, {
                    orderCode: outcome.order.code,
                    total: outcome.order.totalWithTax,
                    items: outcome.items,
                    payUrl,
                });
            }
            case 'out_of_stock':
            case 'no_variant':
                return buildOutOfStockText(msg.fromUserName, outcome.title);
            default:
                return buildOrderFailText(msg.fromUserName, outcome.message);
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

    private storefront(): string {
        return (this.opts.storefrontUrl ?? '').replace(/\/+$/, '');
    }

    private loginUrl(): string | undefined {
        return this.storefront() ? `${this.storefront()}/account/login` : undefined;
    }
}
