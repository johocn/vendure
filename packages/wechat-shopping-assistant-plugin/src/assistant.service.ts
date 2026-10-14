import { Inject, Injectable } from '@nestjs/common';
import {
    Channel,
    ChannelService,
    Customer,
    Logger,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { WechatInboundMessage, WechatMessageEvent } from '@vendure/wechat-auth-plugin';

import {
    buildAwaitingAddressText,
    buildBindGuideText,
    buildBindSuccessText,
    buildFlowCancelledText,
    buildGuideText,
    buildInvalidAddressText,
    buildInvalidOrderText,
    buildInvalidPhoneText,
    buildNewsMessage,
    buildNoResultText,
    buildOrderFailText,
    buildOrderSuccessText,
    buildOutOfStockText,
    buildPhoneTakenText,
    buildSearchErrorText,
    buildSessionExpiredText,
    buildTextListMessage,
    buildWelcomeText,
} from './card-builder';
import { loggerCtx, WECHAT_ASSISTANT_PLUGIN_OPTIONS } from './constants';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
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
        private customerBinding: CustomerBindingService,
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
     * extra.boundPhone：sso 转调时附带的绑定用户手机号（路径 A：vendure 未绑定时自动建档，免输入）。
     * 返回 null = 无需回复（重复消息 / 非文本 / 未识别事件）。
     */
    async processMessage(
        msg: WechatInboundMessage,
        extra?: { boundPhone?: string },
    ): Promise<OutboundMessage | null> {
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? buildWelcomeText(msg.fromUserName) : null;
        }
        if (msg.msgType !== 'text' || !msg.content) return null;

        const ttl = this.opts.sessionTtlMinutes ?? 30;

        // 补录状态机优先：处于手机号/地址补录中的用户，输入不走意图识别
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (session?.state) {
            return this.handleFlowStep(msg, session);
        }

        // 裸手机号入口：未绑定用户直接发手机号 → 进入地址补录（路径 B 第二步直接开始）
        const phone = msg.content.trim().replace(/[-\s]/g, '');
        if (/^1[3-9]\d{9}$/.test(phone)) {
            const bound = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!bound) {
                const channelId = await this.resolveChannelId(msg.channelToken);
                await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
                await this.sessionService.setFlow(msg.fromUserName, 'awaiting_address', { phone, indices: [] }, ttl);
                Logger.info(`Assistant flow awaiting_address (bare phone) openid=${msg.fromUserName}`, loggerCtx);
                return buildAwaitingAddressText(msg.fromUserName, phone);
            }
            // 已绑定用户发手机号：继续走搜索意图（罕见，不拦截）
        }

        const intent = recognizeIntent(msg.content);
        Logger.info(`Assistant intent=${intent.kind} from=${msg.fromUserName}`, loggerCtx);

        switch (intent.kind) {
            case 'help':
                return buildGuideText(msg.fromUserName, this.storefront());
            case 'bind': {
                const bound = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
                if (bound) {
                    return {
                        kind: 'text',
                        touser: msg.fromUserName,
                        content: '您的微信已绑定购物账号，直接发商品名即可下单（如「买一瓶酱油」）。',
                    };
                }
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            case 'search':
                return this.handleSearch(msg, intent.query, intent.quantity ?? 1);
            case 'order':
                return this.handleOrder(msg, intent.indices, extra?.boundPhone);
        }
        return null;
    }

    // ============ 补录状态机：awaiting_phone → awaiting_address → 建档（续下单） ============

    private async handleFlowStep(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
    ): Promise<OutboundMessage | null> {
        const text = (msg.content || '').trim();
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return buildFlowCancelledText(msg.fromUserName);
        }
        if (session.state === 'awaiting_phone') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return buildInvalidPhoneText(msg.fromUserName);
            }
            await this.sessionService.setFlow(
                msg.fromUserName,
                'awaiting_address',
                { phone, indices: session.draft?.indices ?? [] },
                this.opts.sessionTtlMinutes ?? 30,
            );
            Logger.info(`Assistant flow awaiting_address openid=${msg.fromUserName}`, loggerCtx);
            return buildAwaitingAddressText(msg.fromUserName, phone);
        }
        if (session.state === 'awaiting_address') {
            if (text.length < 8) {
                return buildInvalidAddressText(msg.fromUserName);
            }
            const phone = session.draft?.phone;
            if (!phone) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            // 建档前先取待下单编号（清态后 draft 即失效）
            const indices = session.draft?.indices ?? [];
            const picked = session.results.filter(r => indices.includes(r.index));
            const ctx = await this.createShopCtx(session.channelId);
            const outcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, phone, text);
            await this.sessionService.clearFlow(msg.fromUserName);
            switch (outcome.status) {
                case 'ok': {
                    if (!picked.length) return buildBindSuccessText(msg.fromUserName);
                    return this.placeOrder(ctx, msg.fromUserName, outcome.customer, picked);
                }
                case 'phone_taken':
                    return buildPhoneTakenText(msg.fromUserName, this.loginUrl());
                default:
                    return buildOrderFailText(msg.fromUserName, outcome.message);
            }
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
                productUrlTemplate: this.opts.productUrlTemplate,
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

    // ============ 下单：编号回查会话 → 绑定校验/建档 → 建单 → 确认通知 ============

    private async handleOrder(
        msg: WechatInboundMessage,
        indices: number[],
        boundPhone?: string,
    ): Promise<OutboundMessage | null> {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (!session) {
            return buildSessionExpiredText(msg.fromUserName);
        }
        const picked = session.results.filter(r => indices.includes(r.index));
        if (!picked.length) {
            return buildInvalidOrderText(msg.fromUserName, indices);
        }

        // 身份门槛：openid → Customer；未绑定时按可用信息走自动/补录建档
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            const ttl = this.opts.sessionTtlMinutes ?? 30;
            // 路径 A：sso 已绑定用户带手机号 → 自动建档后直接续下单（零输入）
            if (boundPhone) {
                const ctx = await this.createShopCtx(session.channelId);
                const bindOutcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, boundPhone);
                if (bindOutcome.status === 'ok') {
                    Logger.info(
                        `Assistant path-A auto bind: customerId=${bindOutcome.customer.id} openid=${msg.fromUserName}`,
                        loggerCtx,
                    );
                    return this.placeOrder(ctx, msg.fromUserName, bindOutcome.customer, picked);
                }
                if (bindOutcome.status === 'error') {
                    Logger.warn(
                        `Assistant path-A auto bind failed (${bindOutcome.message}), fallback to flow`,
                        loggerCtx,
                    );
                }
                // phone_taken / error → 回退路径 B（聊天内补录另一手机号）
            }
            // 路径 B：进入聊天内补录状态机（手机号 → 收货地址 → 建档续下单）
            await this.sessionService.setFlow(msg.fromUserName, 'awaiting_phone', { indices }, ttl);
            return buildBindGuideText(msg.fromUserName, this.loginUrl());
        }

        const ctx = await this.createShopCtx(session.channelId);
        return this.placeOrder(ctx, msg.fromUserName, customer, picked);
    }

    /** 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示） */
    private async placeOrder(
        ctx: RequestContext,
        touser: string,
        customer: Customer,
        picked: Array<{ productId: string; quantity?: number; title: string }>,
    ): Promise<OutboundMessage> {
        const outcome = await this.orderService.createOrder(
            ctx,
            customer,
            picked.map(p => ({ productId: p.productId, quantity: p.quantity ?? 1 })),
        );

        switch (outcome.status) {
            case 'ok': {
                const payUrl = this.payUrl(outcome.order.code);
                Logger.info(`Assistant order created: ${outcome.order.code}`, loggerCtx);
                return buildOrderSuccessText(touser, {
                    orderCode: outcome.order.code,
                    total: outcome.order.totalWithTax,
                    items: outcome.items,
                    payUrl,
                });
            }
            case 'out_of_stock':
            case 'no_variant':
                return buildOutOfStockText(touser, outcome.title);
            default:
                return buildOrderFailText(touser, outcome.message);
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

    private async resolveChannelId(channelToken: string): Promise<string> {
        if (channelToken) {
            try {
                const channel = await this.channelService.findOne(RequestContext.empty(), channelToken as any);
                if (channel) return String(channel.id);
            } catch {
                // fallthrough
            }
            // findOne 只按 id 查；再按 token 精确匹配（sso 转调经 env 配置传入渠道 token）
            try {
                const { items } = await this.channelService.findAll(RequestContext.empty());
                const byToken = items.find(c => c.token === channelToken);
                if (byToken) return String(byToken.id);
            } catch {
                // fallthrough
            }
        }
        return '1';
    }

    /**
     * 按会话存的渠道 ID 建 shop 上下文：
     * RequestContextService.create 的 channelOrToken 仅认 Channel 实体或 token 字符串，
     * 会话存的是渠道 ID，须先换实体；查不到时传 undefined 落默认渠道（与 resolveChannelId 兜底一致）。
     */
    private async createShopCtx(channelId: string): Promise<RequestContext> {
        const channel = channelId
            ? ((await this.connection.getRepository(Channel).findOne({
                  where: { id: channelId as any },
                  relations: { defaultTaxZone: true, defaultShippingZone: true },
              })) ?? undefined)
            : undefined;
        return this.requestContextService.create({ apiType: 'shop', channelOrToken: channel });
    }

    private storefront(): string {
        return (this.opts.storefrontUrl ?? '').replace(/\/+$/, '');
    }

    private loginUrl(): string | undefined {
        if (this.opts.loginUrlTemplate) return this.opts.loginUrlTemplate;
        return this.storefront() ? `${this.storefront()}/account/login` : undefined;
    }

    /** 支付确认页：优先模板（hash 路由前端，如 `https://host/#/pkg-order/pages/payment?code={code}`） */
    private payUrl(orderCode: string): string | undefined {
        if (this.opts.payUrlTemplate) return this.opts.payUrlTemplate.replace('{code}', encodeURIComponent(orderCode));
        return this.storefront() ? `${this.storefront()}/checkout/confirmation/${orderCode}` : undefined;
    }
}
