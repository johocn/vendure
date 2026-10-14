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

import { AddressBookService } from './address.service';
import {
    buildAddrDefaultSetText,
    buildAddrDeleteConfirm,
    buildAddrDeletedText,
    buildAddrEditFieldText,
    buildAddrEditTextPrompt,
    buildAddrEditPersonPrompt,
    buildAddrNewDefaultText,
    buildAddrNewPhonePromptText,
    buildAddrNewPhoneText,
    buildAddrOpMenu,
    buildAddrSavedText,
    buildAddressListCard,
    buildAwaitingAddressText,
    buildBindGuideText,
    buildBindSuccessText,
    buildFlowCancelledText,
    buildGuideText,
    buildInvalidAddrIndexText,
    buildInvalidAddrPersonText,
    buildInvalidAddressText,
    buildInvalidOrderText,
    buildInvalidPhoneText,
    buildNewsMessage,
    buildNoResultText,
    buildOrderConfirmCard,
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
import { buildDedupKey, normalizeInput, recognizeIntent } from './intent';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { AssistantFlowDraft, OutboundMessage, WechatCredentials, WechatShoppingAssistantOptions } from './types';
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
        private addressBook: AddressBookService,
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
            case 'address_manage':
                return this.handleAddressManage(msg);
            case 'address_add':
                return this.handleAddressAdd(msg);
        }
        return null;
    }

    // ============ 状态机：补录（awaiting_*）+ 地址簿/选址（addr_* / order_confirm） ============

    private async handleFlowStep(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
    ): Promise<OutboundMessage | null> {
        const text = (msg.content || '').trim();
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return buildFlowCancelledText(msg.fromUserName);
        }
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const draft: AssistantFlowDraft = session.draft ?? {};

        if (session.state === 'awaiting_phone') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return buildInvalidPhoneText(msg.fromUserName);
            }
            await this.sessionService.setFlow(
                msg.fromUserName,
                'awaiting_address',
                { phone, indices: draft.indices ?? [] },
                ttl,
            );
            Logger.info(`Assistant flow awaiting_address openid=${msg.fromUserName}`, loggerCtx);
            return buildAwaitingAddressText(msg.fromUserName, phone);
        }
        if (session.state === 'awaiting_address') {
            if (text.length < 8) {
                return buildInvalidAddressText(msg.fromUserName);
            }
            const phone = draft.phone;
            if (!phone) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            // 建档前先取待下单编号（清态后 draft 即失效）
            const indices = draft.indices ?? [];
            const picked = session.results.filter(r => indices.includes(r.index));
            const ctx = await this.createShopCtx(session.channelId);
            const outcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, phone, text);
            await this.sessionService.clearFlow(msg.fromUserName);
            switch (outcome.status) {
                case 'ok': {
                    if (!picked.length) return buildBindSuccessText(msg.fromUserName);
                    // 建档首地址即默认地址，placeOrder 内自动取默认地址落单
                    return this.placeOrder(ctx, msg.fromUserName, outcome.customer, picked);
                }
                case 'phone_taken':
                    return buildPhoneTakenText(msg.fromUserName, this.loginUrl());
                default:
                    return buildOrderFailText(msg.fromUserName, outcome.message);
            }
        }
        if (session.state === 'addr_pick') {
            return this.onAddrPick(msg, session, text, draft, ttl);
        }
        if (session.state === 'addr_op') {
            return this.onAddrOp(msg, session, text, draft, ttl);
        }
        if (session.state === 'addr_edit_field') {
            const input = normalizeInput(text);
            if (input === '1') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_text', draft, ttl);
                return buildAddrEditTextPrompt(msg.fromUserName);
            }
            if (input === '2') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_person', draft, ttl);
                return buildAddrEditPersonPrompt(msg.fromUserName);
            }
            return buildAddrEditFieldText(msg.fromUserName, draft.pickIndex ?? 0);
        }
        if (session.state === 'addr_edit_text') {
            if (text.length < 8) {
                return buildInvalidAddressText(msg.fromUserName);
            }
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome) return buildBindGuideText(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, text);
            if (!ok) return buildOrderFailText(msg.fromUserName, '修改地址失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return buildAddrSavedText(msg.fromUserName, updated!);
        }
        if (session.state === 'addr_edit_person') {
            // 「姓名 电话」一行（姓名取最后一个空格前的全部，支持英文姓名）；只发号码 = 只改电话
            let fullName: string | undefined;
            let phone: string | undefined;
            const bare = text.replace(/[-\s]/g, '');
            const m = text.match(/^(.+)\s+(1[3-9]\d{9})$/);
            if (/^1[3-9]\d{9}$/.test(bare)) {
                phone = bare;
            } else if (m) {
                fullName = m[1].trim().slice(0, 50);
                phone = m[2];
            } else {
                return buildInvalidAddrPersonText(msg.fromUserName);
            }
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome) return buildBindGuideText(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updatePerson(outcome.ctx, outcome.addressId, {
                fullName,
                phoneNumber: phone,
            });
            if (!ok) return buildOrderFailText(msg.fromUserName, '修改收货人信息失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return buildAddrSavedText(msg.fromUserName, updated!);
        }
        if (session.state === 'addr_del_confirm') {
            const input = normalizeInput(text);
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome) return buildBindGuideText(msg.fromUserName, this.loginUrl());
            const item = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            if (!item) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                return buildInvalidAddrIndexText(msg.fromUserName, 1);
            }
            if (input === '1') {
                const ok = await this.addressBook.remove(outcome.ctx, outcome.addressId);
                if (!ok) return buildOrderFailText(msg.fromUserName, '删除地址失败');
                const remaining = await this.addressBook.list(outcome.ctx, outcome.customerId);
                // core 已把默认顶替给剩余最早地址；仅当删的是默认时展示切换/无默认提示
                const newDefault = item.isDefault ? (remaining.find(a => a.isDefault) ?? null) : undefined;
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                Logger.info(
                    `Assistant address removed: addressId=${outcome.addressId} wasDefault=${item.isDefault}`,
                    loggerCtx,
                );
                return buildAddrDeletedText(msg.fromUserName, newDefault);
            }
            if (input === '0') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                const items = await this.addressBook.list(outcome.ctx, outcome.customerId);
                return buildAddressListCard(msg.fromUserName, items, 'manage');
            }
            return buildAddrDeleteConfirm(msg.fromUserName, item);
        }
        if (session.state === 'addr_new_text') {
            if (text.length < 8) {
                return buildInvalidAddressText(msg.fromUserName);
            }
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            const nextDraft: AssistantFlowDraft = { ...draft, pendingText: text.slice(0, 250) };
            const registeredPhone = customer.phoneNumber ?? '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', nextDraft, ttl);
                return buildAddrNewPhoneText(msg.fromUserName, registeredPhone);
            }
            // 无注册手机号：跳过选择直接收号码
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', nextDraft, ttl);
            return buildAddrNewPhonePromptText(msg.fromUserName);
        }
        if (session.state === 'addr_new_phone') {
            const input = normalizeInput(text);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            const registeredPhone = customer?.phoneNumber ?? '';
            if (input === '1' && registeredPhone) {
                if (!draft.pendingText) {
                    await this.sessionService.clearFlow(msg.fromUserName);
                    return buildBindGuideText(msg.fromUserName, this.loginUrl());
                }
                await this.sessionService.setFlow(
                    msg.fromUserName,
                    'addr_new_default',
                    { ...draft, pendingPhone: registeredPhone },
                    ttl,
                );
                return buildAddrNewDefaultText(msg.fromUserName, draft.pendingText, registeredPhone);
            }
            if (input === '2' || (input === '1' && !registeredPhone)) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', draft, ttl);
                return buildAddrNewPhonePromptText(msg.fromUserName);
            }
            return buildAddrNewPhoneText(msg.fromUserName, registeredPhone || undefined);
        }
        if (session.state === 'addr_new_phone_text') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return buildInvalidPhoneText(msg.fromUserName);
            }
            if (!draft.pendingText) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            await this.sessionService.setFlow(
                msg.fromUserName,
                'addr_new_default',
                { ...draft, pendingPhone: phone },
                ttl,
            );
            return buildAddrNewDefaultText(msg.fromUserName, draft.pendingText, phone);
        }
        if (session.state === 'addr_new_default') {
            const input = normalizeInput(text);
            if (input !== '是' && input !== '否') {
                return buildAddrNewDefaultText(msg.fromUserName, draft.pendingText ?? '', draft.pendingPhone ?? '');
            }
            const ctx = await this.createShopCtx(session.channelId);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            const addressId = await this.addressBook.add(ctx, customer.id, {
                streetLine1: draft.pendingText ?? '',
                phoneNumber: draft.pendingPhone ?? '',
                setDefault: input === '是',
            });
            if (!addressId) return buildOrderFailText(msg.fromUserName, '保存地址失败');
            const item = await this.addressBook.getItem(ctx, customer.id, addressId);
            Logger.info(
                `Assistant address added: addressId=${addressId} flow=${draft.flow ?? 'manage'}`,
                loggerCtx,
            );
            // 下单流程：新地址直接进下单确认；管理流程：落库后回列表态
            if (draft.flow === 'order') {
                await this.sessionService.setFlow(
                    msg.fromUserName,
                    'order_confirm',
                    { ...draft, pickAddressId: addressId },
                    ttl,
                );
                return this.orderConfirmCard(ctx, msg.fromUserName, session, { ...draft, pickAddressId: addressId });
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return buildAddrSavedText(msg.fromUserName, item!);
        }
        if (session.state === 'order_confirm') {
            const input = normalizeInput(text);
            const ctx = await this.createShopCtx(session.channelId);
            if (input === '0') {
                await this.sessionService.setFlow(
                    msg.fromUserName,
                    'addr_pick',
                    { ...draft, pickIndex: null, pickAddressId: null },
                    ttl,
                );
                const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
                if (!customer) {
                    await this.sessionService.clearFlow(msg.fromUserName);
                    return buildBindGuideText(msg.fromUserName, this.loginUrl());
                }
                const items = await this.addressBook.list(ctx, customer.id);
                return buildAddressListCard(msg.fromUserName, items, 'order');
            }
            if (input !== '1') {
                return this.orderConfirmCard(ctx, msg.fromUserName, session, draft);
            }
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            const picked = session.results.filter(r => (draft.indices ?? []).includes(r.index));
            if (!picked.length) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildSessionExpiredText(msg.fromUserName);
            }
            const out = await this.placeOrder(ctx, msg.fromUserName, customer, picked, draft.pickAddressId ?? undefined);
            await this.sessionService.clearFlow(msg.fromUserName);
            return out;
        }
        return null;
    }

    /**
     * 管理态分支公共上下文：ctx + 顾客 + 选定地址 id；顾客失效返回 null（调用方回绑定引导）。
     * 地址已被删除（列表变动）时 addressId 仍在草稿中，由 getItem 返回 null 让调用方回列表态。
     */
    private async withAddrCtx(
        msg: WechatInboundMessage,
        draft: AssistantFlowDraft,
    ): Promise<{ ctx: RequestContext; customerId: string; addressId: string } | null> {
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer || !draft.pickAddressId) return null;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const ctx = await this.createShopCtx(session?.channelId ?? '1');
        return { ctx, customerId: String(customer.id), addressId: draft.pickAddressId };
    }

    /** addr_pick：回复编号选址（order → 下单确认 / manage → 操作菜单），0/「新增」进新增流程 */
    private async onAddrPick(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
        text: string,
        draft: AssistantFlowDraft,
        ttl: number,
    ): Promise<OutboundMessage | null> {
        const input = normalizeInput(text);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return buildBindGuideText(msg.fromUserName, this.loginUrl());
        }
        const ctx = await this.createShopCtx(session.channelId);
        const items = await this.addressBook.list(ctx, customer.id);
        if (input === '0' || input === '新增' || input === '添加') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', draft, ttl);
            return buildAddrEditTextPrompt(msg.fromUserName);
        }
        const n = /^\d{1,2}$/.test(input) ? Number(input) : 0;
        if (n < 1 || n > items.length) {
            return buildInvalidAddrIndexText(msg.fromUserName, Math.max(items.length, 1));
        }
        const item = items[n - 1];
        if (draft.flow === 'manage') {
            await this.sessionService.setFlow(
                msg.fromUserName,
                'addr_op',
                { ...draft, pickIndex: n, pickAddressId: item.id },
                ttl,
            );
            return buildAddrOpMenu(msg.fromUserName, item);
        }
        await this.sessionService.setFlow(
            msg.fromUserName,
            'order_confirm',
            { ...draft, pickIndex: n, pickAddressId: item.id },
            ttl,
        );
        return this.orderConfirmCard(ctx, msg.fromUserName, session, { ...draft, pickAddressId: item.id });
    }

    /** addr_op：管理态操作菜单（1 设默认 / 2 修改 / 3 删除 / 0 返回列表） */
    private async onAddrOp(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
        text: string,
        draft: AssistantFlowDraft,
        ttl: number,
    ): Promise<OutboundMessage | null> {
        const input = normalizeInput(text);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        const ctx = await this.createShopCtx(session.channelId);
        const addressId = draft.pickAddressId;
        const item = customer && addressId ? await this.addressBook.getItem(ctx, customer.id, addressId) : null;
        if (!customer || !item) {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return buildInvalidAddrIndexText(msg.fromUserName, 1);
        }
        if (input === '1') {
            const ok = await this.addressBook.setDefault(ctx, item.id);
            if (!ok) return buildOrderFailText(msg.fromUserName, '设置默认地址失败');
            const updated = await this.addressBook.getItem(ctx, customer.id, item.id);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            Logger.info(`Assistant address default set: addressId=${item.id}`, loggerCtx);
            return buildAddrDefaultSetText(msg.fromUserName, updated ?? item);
        }
        if (input === '2') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_field', draft, ttl);
            return buildAddrEditFieldText(msg.fromUserName, item.index);
        }
        if (input === '3') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_del_confirm', draft, ttl);
            return buildAddrDeleteConfirm(msg.fromUserName, item);
        }
        if (input === '0') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            const items = await this.addressBook.list(ctx, customer.id);
            return buildAddressListCard(msg.fromUserName, items, 'manage');
        }
        return buildAddrOpMenu(msg.fromUserName, item);
    }

    /** 「地址管理」入口：列地址簿 → addr_pick（manage 态） */
    private async handleAddressManage(msg: WechatInboundMessage): Promise<OutboundMessage | null> {
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) return buildBindGuideText(msg.fromUserName, this.loginUrl());
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const ctx = await this.createShopCtx(channelId);
        const items = await this.addressBook.list(ctx, customer.id);
        await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
        Logger.info(`Assistant address book opened: customerId=${customer.id} count=${items.length}`, loggerCtx);
        return buildAddressListCard(msg.fromUserName, items, 'manage');
    }

    /** 「新增地址」入口：直接进新增地址文本状态（manage 流程） */
    private async handleAddressAdd(msg: WechatInboundMessage): Promise<OutboundMessage | null> {
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) return buildBindGuideText(msg.fromUserName, this.loginUrl());
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', { flow: 'manage' }, ttl);
        return buildAddrEditTextPrompt(msg.fromUserName);
    }

    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导 */
    private async orderConfirmCard(
        ctx: RequestContext,
        touser: string,
        session: WechatShoppingSession,
        draft: AssistantFlowDraft,
    ): Promise<OutboundMessage> {
        const picked = session.results.filter(r => (draft.indices ?? []).includes(r.index));
        if (!picked.length) return buildSessionExpiredText(touser);
        const customer = await this.customerBinding.findCustomerByOpenid(touser);
        if (!customer) return buildBindGuideText(touser, this.loginUrl());
        const items = await this.addressBook.list(ctx, customer.id);
        const address =
            (draft.pickAddressId ? items.find(a => a.id === draft.pickAddressId) : null) ??
            items.find(a => a.isDefault) ??
            items[0];
        if (!address) return buildAddressListCard(touser, [], 'order');
        return buildOrderConfirmCard(touser, {
            items: picked.map(p => ({ title: p.title, quantity: p.quantity ?? 1, price: p.price })),
            total: picked.reduce((s, p) => s + p.price * (p.quantity ?? 1), 0),
            address,
        });
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

        // 已绑定：出地址列表选址（⭐默认置顶），无地址直接进新增
        const ctx = await this.createShopCtx(session.channelId);
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const addressItems = await this.addressBook.list(ctx, customer.id);
        if (!addressItems.length) {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', { indices, flow: 'order' }, ttl);
            return buildAddressListCard(msg.fromUserName, [], 'order');
        }
        await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { indices, flow: 'order' }, ttl);
        return buildAddressListCard(msg.fromUserName, addressItems, 'order');
    }

    /**
     * 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示）。
     * addressId：对话选址的地址；未传时回退顾客默认地址（建档续下单场景——
     * 路径 A/B 刚建档的首地址即默认，直接落单保持零输入）。
     * 选定地址含收货人/电话，随 setShippingAddress 写入订单。
     */
    private async placeOrder(
        ctx: RequestContext,
        touser: string,
        customer: Customer,
        picked: Array<{ productId: string; quantity?: number; title: string }>,
        addressId?: string,
    ): Promise<OutboundMessage> {
        const addressItems = await this.addressBook.list(ctx, customer.id);
        const addrItem =
            (addressId ? addressItems.find(a => a.id === addressId) : null) ??
            addressItems.find(a => a.isDefault) ??
            undefined;
        const address = addrItem
            ? { fullName: addrItem.fullName, phoneNumber: addrItem.phoneNumber, streetLine1: addrItem.streetLine1 }
            : undefined;
        if (addrItem) {
            Logger.info(`Assistant order shipping address: addressId=${addrItem.id}`, loggerCtx);
        }
        const outcome = await this.orderService.createOrder(
            ctx,
            customer,
            picked.map(p => ({ productId: p.productId, quantity: p.quantity ?? 1 })),
            address,
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

    /** 地址流程目标渠道：优先复用既有会话的渠道（用户在该渠道搜的品），无会话按消息渠道 token */
    private async resolveSessionChannelId(msg: WechatInboundMessage): Promise<string> {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (session?.channelId) return session.channelId;
        return this.resolveChannelId(msg.channelToken);
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
