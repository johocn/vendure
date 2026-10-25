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
    buildChannelSwitchText,
    buildFlowCancelledText,
    buildGuideText,
    buildInvalidAddrIndexText,
    buildInvalidAddrPersonText,
    buildInvalidAddressText,
    buildInvalidOrderText,
    buildInvalidPhoneText,
    buildLocationFlowBusyText,
    buildLocationInvalidText,
    buildLocationRecognizedText,
    buildLocationUnavailableText,
    buildNearbyStoresText,
    buildNewsMessage,
    buildNoNearbyStoresText,
    buildNoPaymentMethodText,
    buildNoResultText,
    buildOrderConfirmCard,
    buildOrderFailText,
    buildOrderSuccessText,
    buildOutOfRangeText,
    buildOutOfStockText,
    buildPaymentMethodsInfoText,
    buildPaymentPickText,
    buildPhoneTakenText,
    buildSearchErrorText,
    buildSessionExpiredText,
    buildShopInfoCard,
    buildStoreFlowBusyText,
    buildStoreNeedLocationText,
    buildStoreSelectedText,
    buildStoreSelectionInvalidText,
    buildSupportCard,
    buildSupportInvalidStoreText,
    buildSupportNoteCancelledText,
    buildSupportNotePromptText,
    buildSupportNoteSavedText,
    buildSupportNoteTooLongText,
    buildSupportRepeatText,
    buildSupportStorePickText,
    SUPPORT_WECHAT_AFTER,
    SUPPORT_WECHAT_ID,
    buildTextListMessage,
    buildWelcomeText,
    formatPrice,
} from './card-builder';
import { DeliveryGuardService } from './city/delivery-guard.service';
import { TenantRouterService } from './city/tenant-router.service';
import { loggerCtx, WECHAT_ASSISTANT_PLUGIN_OPTIONS } from './constants';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
import { GeoService, ReverseAddressResult } from './geo.service';
import { buildDedupKey, normalizeInput, parseOrderIndices, recognizeIntent } from './intent';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { StoreLocatorService } from './store-locator.service';
import { SupportTicketService } from './support-ticket.service';
import {
    AssistantAddressGeo,
    AssistantFlowDraft,
    AssistantFlowState,
    NearbyStore,
    OutboundMessage,
    StoreContact,
    WechatCredentials,
    WechatShoppingAssistantOptions,
} from './types';
import { WechatSender } from './wechat-sender';

/** 同一门店「客服」重复请求窗口：窗口内只回短提示，避免刷屏（PRD FR-07） */
const SUPPORT_REPEAT_WINDOW_MS = 10 * 60 * 1000;

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
        private geoService: GeoService,
        private storeLocator: StoreLocatorService,
        private supportTickets: SupportTicketService,
        private readonly deliveryGuard: DeliveryGuardService,
        private readonly tenantRouter: TenantRouterService,
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
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本/位置）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? buildWelcomeText(msg.fromUserName) : null;
        }
        if (msg.msgType === 'location') return this.handleLocationMessage(msg);
        if (msg.msgType !== 'text' || !msg.content) return null;

        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const session = await this.sessionService.getActive(msg.fromUserName);

        // 留言输入态：这句话就是留言正文，不再识别指令（取消例外，见 onSupportNote）
        if (session?.state === 'support_note') return this.onSupportNote(msg, session);

        // 全局「一键客服 / 留言 / 支付方式」：任何状态下优先响应，不打断原流程
        const earlyIntent = recognizeIntent(msg.content);
        if (earlyIntent.kind === 'support') return this.handleSupport(msg, earlyIntent.storeIndex);
        if (earlyIntent.kind === 'support_note') return this.handleSupportNoteStart(msg, session);
        if (earlyIntent.kind === 'payment_methods') return this.handlePaymentMethodsInfo(msg, session);

        // 补录状态机优先：处于手机号/地址补录中的用户，输入不走意图识别
        if (session?.state) {
            return this.handleFlowStep(msg, session);
        }

        // 空闲态定位后回复「门店N」：回查最近一次门店列表选用（不额外占用会话状态）
        if (session?.draft?.nearbyStores?.length && /^门店\d{1,2}[!！。.~]?$/.test(normalizeInput(msg.content))) {
            return this.onStorePick(msg, msg.content, session.draft, ttl);
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
            case 'nearby_stores':
                return this.handleNearbyStores(msg);
            case 'payment_methods':
                return this.handlePaymentMethodsInfo(msg, session);
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
        // 地址流程态（addr_* / order_confirm）放行显式指令（状态机优先但指令不放行会成死胡同：
        // 重发「地址管理」被当无效编号；「买N」无法重新下单；补录态（awaiting_*）不放行）。
        // 新增入口保留 order 流程上下文。
        const inAddrFlow =
            session.state?.startsWith('addr_') ||
            session.state === 'order_confirm' ||
            session.state === 'pay_pick';
        if (inAddrFlow) {
            const flowIntent = recognizeIntent(text);
            if (flowIntent.kind === 'address_manage') return this.handleAddressManage(msg);
            if (flowIntent.kind === 'address_add') {
                const sessionNow = await this.sessionService.getActive(msg.fromUserName);
                const keepFlow = sessionNow?.draft?.flow === 'order' ? sessionNow.draft : { flow: 'manage' as const };
                return this.handleAddressAdd(msg, keepFlow);
            }
            // 显式「买N」（带引导词）= 重新开始下单（重列地址选址）；
            // 纯数字「1」在地址流态是编号回复（选地址/菜单项），不放行
            const explicitOrder =
                flowIntent.kind === 'order' && /^(?:购买|下单|订购|买|要|来|购|拍)/.test(normalizeInput(text));
            if (explicitOrder) return this.handleOrder(msg, flowIntent.indices);
            if (flowIntent.kind === 'nearby_stores') return buildStoreFlowBusyText(msg.fromUserName);
        }
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const draft: AssistantFlowDraft = session.draft ?? {};

        // 门店选择态可重新拉取附近门店（城市/位置可能已更新）
        if (session.state === 'store_pick' && recognizeIntent(text).kind === 'nearby_stores') {
            return this.handleNearbyStores(msg);
        }

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
            // 建档首地址：地理编码失败不阻塞建档，仅少写坐标（后续可在地址簿补录）
            const geo = await this.geoService.geocode(ctx, text);
            const outcome = await this.customerBinding.bindOrCreateCustomer(
                ctx,
                msg.fromUserName,
                phone,
                text,
                geo,
            );
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
        if (session.state === 'store_pick') {
            return this.onStorePick(msg, text, draft, ttl);
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
            const geo = await this.geoService.geocode(outcome.ctx, text);
            const geoFields = geo
                ? { latitude: geo.lat, longitude: geo.lng, province: geo.province, city: geo.city }
                : undefined;
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, text, geoFields);
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
            const geo = await this.geoService.geocode(
                await this.createShopCtx(session.channelId),
                text,
                this.geoHint(draft),
            );
            nextDraft.geo = geo;
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
                ...(draft.geo
                    ? {
                          province: draft.geo.province,
                          city: draft.geo.city,
                          latitude: draft.geo.lat,
                          longitude: draft.geo.lng,
                      }
                    : {}),
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
        if (session.state === 'pay_pick') {
            return this.onPayPick(msg, session, text, draft, ttl);
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
            // 换支付方式：仅 ≥2 个可用时有意义
            const methods = await this.orderService.listPaymentMethods(ctx);
            if (!methods.length) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildNoPaymentMethodText(msg.fromUserName);
            }
            if (input === '9' && methods.length > 1) {
                await this.sessionService.setFlow(
                    msg.fromUserName,
                    'pay_pick',
                    { ...draft, paymentMethodCode: null, paymentMethods: methods },
                    ttl,
                );
                return buildPaymentPickText(msg.fromUserName, methods);
            }
            if (input !== '1') {
                return this.orderConfirmCard(ctx, msg.fromUserName, session, draft);
            }
            // 确认时点复核：选中的支付方式可能刚被后台关闭
            const selected =
                methods.find(m => m.code === draft.paymentMethodCode) ?? methods[0];
            if (draft.paymentMethodCode && !methods.some(m => m.code === draft.paymentMethodCode)) {
                const closedName =
                    draft.paymentMethods?.find(m => m.code === draft.paymentMethodCode)?.name ??
                    draft.paymentMethodCode;
                await this.sessionService.setFlow(
                    msg.fromUserName,
                    'pay_pick',
                    { ...draft, paymentMethodCode: null, paymentMethods: methods },
                    ttl,
                );
                return buildPaymentPickText(
                    msg.fromUserName,
                    methods,
                    `「${closedName}」刚关闭了，当前可用：`,
                );
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
            const out = await this.placeOrder(
                ctx,
                msg.fromUserName,
                customer,
                picked,
                draft.pickAddressId ?? undefined,
                selected,
            );
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

    /** 「新增地址」入口：直接进新增地址文本状态（默认 manage 流程；下单流程传入保留 order 上下文） */
    private async handleAddressAdd(
        msg: WechatInboundMessage,
        initialDraft: AssistantFlowDraft = { flow: 'manage' },
    ): Promise<OutboundMessage | null> {
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) return buildBindGuideText(msg.fromUserName, this.loginUrl());
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const session = await this.sessionService.getActive(msg.fromUserName);
        // 空闲态发过位置：直接复用缓存的定位地址，跳过地址文本输入
        const locatedText = session?.draft?.pendingText?.trim() ?? '';
        const locatedGeo = session?.draft?.geo ?? null;
        if (locatedText.length >= 8 && locatedGeo) {
            const draft: AssistantFlowDraft = { ...initialDraft, pendingText: locatedText, geo: locatedGeo };
            const registeredPhone = customer.phoneNumber ?? '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', draft, ttl);
                return buildAddrNewPhoneText(msg.fromUserName, registeredPhone);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', draft, ttl);
            return buildAddrNewPhonePromptText(msg.fromUserName);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', initialDraft, ttl);
        return buildAddrEditTextPrompt(msg.fromUserName);
    }

    // ============ 位置消息：逆地理 → 按会话态写入地址 ============

    /**
     * 微信「发送位置」消息：
     * - 空闲态：缓存定位结果（「新增地址」可直接复用），不改变会话状态；
     * - 地址录入态（awaiting_address / addr_new_text / addr_edit_text）：直接作为收货地址写入；
     * - 其他状态：提示先完成当前步骤，不打断流程。
     */
    private async handleLocationMessage(msg: WechatInboundMessage): Promise<OutboundMessage | null> {
        const lat = Number(msg.latitude);
        const lng = Number(msg.longitude);
        if (!GeoService.isValidCoordinate(lat, lng)) {
            return buildLocationInvalidText(msg.fromUserName);
        }
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const state = (session?.state ?? null) as AssistantFlowState;
        const addressInputStates: AssistantFlowState[] = ['awaiting_address', 'addr_new_text', 'addr_edit_text'];
        if (state && !addressInputStates.includes(state)) {
            Logger.info(`Assistant location ignored in state=${state} openid=${msg.fromUserName}`, loggerCtx);
            return buildLocationFlowBusyText(msg.fromUserName);
        }

        const channelId = session?.channelId ?? (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const reverse = await this.geoService.reverse(ctx, lat, lng);
        if (!reverse) return buildLocationUnavailableText(msg.fromUserName);
        const addressText = GeoService.composeAddressText(reverse, msg.label);
        if (addressText.length < 8) {
            Logger.info(`Assistant location address too short: openid=${msg.fromUserName}`, loggerCtx);
            return buildLocationUnavailableText(msg.fromUserName);
        }
        const geo = geoPointFromReverse(reverse, lat, lng);

        // 空闲态：缓存定位 + 识别城市 + 匹配 3km 门店，供「新增地址」「附近门店」直接使用
        if (!state) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            const nearbyStores = await this.matchStores(ctx, msg.fromUserName, lat, lng);
            await this.sessionService.saveDraft(
                msg.fromUserName,
                {
                    ...(session?.draft ?? {}),
                    pendingText: addressText.slice(0, 250),
                    geo,
                    city: reverse.city ?? null,
                    nearbyStores,
                },
                ttl,
            );
            Logger.info(
                `Assistant location cached: openid=${msg.fromUserName} city=${reverse.city ?? ''} stores=${nearbyStores.length}`,
                loggerCtx,
            );
            return buildLocationRecognizedText(msg.fromUserName, addressText, nearbyStores);
        }

        const draft: AssistantFlowDraft = session?.draft ?? {};

        if (state === 'awaiting_address') {
            const phone = draft.phone;
            if (!phone) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            const indices = draft.indices ?? [];
            const picked = (session?.results ?? []).filter(r => indices.includes(r.index));
            const outcome = await this.customerBinding.bindOrCreateCustomer(
                ctx,
                msg.fromUserName,
                phone,
                addressText,
                geo,
            );
            await this.sessionService.clearFlow(msg.fromUserName);
            switch (outcome.status) {
                case 'ok':
                    if (!picked.length) return buildBindSuccessText(msg.fromUserName);
                    return this.placeOrder(ctx, msg.fromUserName, outcome.customer, picked);
                case 'phone_taken':
                    return buildPhoneTakenText(msg.fromUserName, this.loginUrl());
                default:
                    return buildOrderFailText(msg.fromUserName, outcome.message);
            }
        }

        if (state === 'addr_new_text') {
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return buildBindGuideText(msg.fromUserName, this.loginUrl());
            }
            const nextDraft: AssistantFlowDraft = {
                ...draft,
                pendingText: addressText.slice(0, 250),
                geo,
                city: reverse.city ?? null,
            };
            const registeredPhone = customer.phoneNumber ?? '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', nextDraft, ttl);
                return buildAddrNewPhoneText(msg.fromUserName, registeredPhone);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', nextDraft, ttl);
            return buildAddrNewPhonePromptText(msg.fromUserName);
        }

        if (state === 'addr_edit_text') {
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome) return buildBindGuideText(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, addressText, {
                latitude: lat,
                longitude: lng,
                province: reverse.province,
                city: reverse.city,
            });
            if (!ok) return buildOrderFailText(msg.fromUserName, '修改地址失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return buildAddrSavedText(msg.fromUserName, updated!);
        }

        return buildLocationFlowBusyText(msg.fromUserName);
    }

    /** 地理编码城市提示：已有定位结果时用其城市提升文本地址命中率 */
    private geoHint(draft: AssistantFlowDraft): { city?: string | null } | undefined {
        return draft.geo?.city ? { city: draft.geo.city } : undefined;
    }

    // ============ 城市识别 + 3km 门店匹配（熟店优先） ============

    /** 定位坐标 → 3km 内门店（熟店优先）；顾客未绑定/门店服务异常一律降级为空列表 */
    private async matchStores(
        ctx: RequestContext,
        openid: string,
        lat: number,
        lng: number,
    ): Promise<NearbyStore[]> {
        try {
            const customer = await this.customerBinding.findCustomerByOpenid(openid);
            const familiarStoreIds = await this.storeLocator.familiarStoreIds(ctx, customer?.id);
            return await this.storeLocator.findNearby(ctx, lat, lng, { familiarStoreIds });
        } catch (e) {
            Logger.warn(`Assistant store matching failed: ${String(e)}`, loggerCtx);
            return [];
        }
    }

    /** 「附近门店」：用最近一次定位坐标匹配（无定位先引导发送位置） */
    private async handleNearbyStores(msg: WechatInboundMessage): Promise<OutboundMessage | null> {
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const draft: AssistantFlowDraft = session?.draft ?? {};
        const geo = draft.geo;
        if (!geo || !GeoService.isValidCoordinate(geo.lat, geo.lng)) {
            return buildStoreNeedLocationText(msg.fromUserName);
        }
        const channelId = session?.channelId ?? (await this.resolveChannelId(msg.channelToken));
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const ctx = await this.createShopCtx(channelId);
        const city = draft.city ?? geo.city ?? null;
        const stores = await this.matchStores(ctx, msg.fromUserName, geo.lat, geo.lng);
        if (!stores.length) {
            return buildNoNearbyStoresText(msg.fromUserName, city);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'store_pick', { ...draft, nearbyStores: stores }, ttl);
        Logger.info(`Assistant nearby stores listed: openid=${msg.fromUserName} count=${stores.length}`, loggerCtx);
        return buildNearbyStoresText(msg.fromUserName, stores, city);
    }

    /** store_pick：回复「门店N」/「N」选定门店（记入草稿，供后续下单就近安排） */
    private async onStorePick(
        msg: WechatInboundMessage,
        text: string,
        draft: AssistantFlowDraft,
        ttl: number,
    ): Promise<OutboundMessage | null> {
        const stores = draft.nearbyStores ?? [];
        const indices = parseOrderIndices(normalizeInput(text).replace(/^门店/, ''));
        const index = indices?.[0] ?? 0;
        if (index < 1 || index > stores.length) {
            return buildStoreSelectionInvalidText(msg.fromUserName, stores.length);
        }
        const store = stores[index - 1];
        await this.sessionService.setFlow(msg.fromUserName, null, { ...draft, storeId: store.id }, ttl);
        Logger.info(`Assistant store selected: openid=${msg.fromUserName} storeId=${store.id}`, loggerCtx);
        return buildStoreSelectedText(msg.fromUserName, store);
    }

    // ============ 一键客服（全局，任何状态生效，不打断原流程） ============

    /**
     * 客服卡片：先引导「在线留言」，不展示电话；同一会话第 3 次求助起附客服微信。
     * 多候选未选 → 「客服N」选择；同一门店 10 分钟内重复只回短提示。
     * 全程不改会话状态（用户下一次输入仍按原流程处理）。
     */
    private async handleSupport(msg: WechatInboundMessage, storeIndex?: number): Promise<OutboundMessage> {
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const draft: AssistantFlowDraft = session?.draft ?? {};
        const stores = draft.nearbyStores ?? [];
        const channelId = session?.channelId ?? (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);

        // 同一会话内「客服」求助次数：第 3 次起提供客服微信（引导发语音）
        const askCount = Number(draft.supportAskCount ?? 0) + 1;
        const wechatId = askCount >= SUPPORT_WECHAT_AFTER ? SUPPORT_WECHAT_ID : null;

        let contact: StoreContact | null = null;
        if (storeIndex != null) {
            const picked = stores[storeIndex - 1];
            if (!picked) return buildSupportInvalidStoreText(msg.fromUserName, stores.length);
            contact = (await this.storeLocator.findContact(ctx, picked.id)) ?? this.contactFromNearby(picked);
        } else if (draft.storeId) {
            contact =
                (await this.storeLocator.findContact(ctx, draft.storeId)) ??
                this.contactFromNearby(stores.find(store => store.id === draft.storeId));
        } else if (stores.length === 1) {
            contact = (await this.storeLocator.findContact(ctx, stores[0].id)) ?? this.contactFromNearby(stores[0]);
        }

        // 多个候选且未选门店：先让用户用「客服N」指定（不进入状态机）
        if (!contact && stores.length > 1) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            await this.sessionService.saveDraft(
                msg.fromUserName,
                { ...draft, supportAskCount: askCount },
                ttl,
            );
            return buildSupportStorePickText(msg.fromUserName, stores, wechatId);
        }

        const now = Date.now();
        const sameTarget = String(draft.supportStoreId ?? '') === String(contact?.id ?? '');
        // 第 3 次起必须带微信号，不再走「重复只回短提示」
        if (!wechatId && now - Number(draft.supportAt ?? 0) < SUPPORT_REPEAT_WINDOW_MS && sameTarget) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            await this.sessionService.saveDraft(
                msg.fromUserName,
                { ...draft, supportAskCount: askCount },
                ttl,
            );
            return buildSupportRepeatText(msg.fromUserName, { name: contact?.name ?? null });
        }

        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const picked = (session?.results ?? []).filter(r => (draft.indices ?? []).includes(r.index));
        const items = picked.map(r => ({ title: r.title, quantity: r.quantity ?? 1, price: r.price }));
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        await this.sessionService.saveDraft(
            msg.fromUserName,
            { ...draft, supportAt: now, supportStoreId: contact?.id ?? null, supportAskCount: askCount },
            ttl,
        );
        Logger.info(
            `Assistant support card: openid=${msg.fromUserName} store=${contact?.id ?? 'none'} ask=${askCount} wechat=${Boolean(wechatId)}`,
            loggerCtx,
        );
        const cf = (ctx.channel?.customFields as any) ?? {};
        return buildSupportCard(msg.fromUserName, {
            store: contact
                ? { name: contact.name, phoneNumber: contact.phoneNumber, businessHours: contact.businessHours }
                : null,
            items,
            total: items.length ? total : undefined,
            shopName: String(cf.shopName ?? '').trim() || null,
            shopUrl: this.shopUrlOf(cf),
            wechatId,
        });
    }

    /** 渠道店铺域名 → 绝对地址（兼容只存 `host/path` 的配置） */
    private shopUrlOf(cf: any): string | null {
        const raw = String(cf?.domain ?? '').trim();
        if (!raw) return null;
        return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
    }

    /**
     * 店铺名/简称识别：查询词等于店铺名（或去掉「店/超市」等后缀的主体）时回店铺信息。
     * 品类通用词（米/面/油/粮油…）不当作店名，避免挡住正常商品检索。
     */
    private matchShopQuery(
        query: string,
        cf: any,
    ): { name: string; intro?: string | null; url?: string | null } | null {
        const name = String(cf?.shopName ?? '').trim();
        if (!name) return null;
        const q = normalizeInput(query);
        if (q.length < 2) return null;
        const categoryWords = ['米', '面', '油', '粉', '粮油', '大米', '面粉', '食用油', '杂粮', '食品', '五谷'];
        if (categoryWords.includes(q)) return null;
        const core = name.replace(/(粮油店|食品店|旗舰店|便利店|超市|商店|商行|店铺|店)$/u, '');
        if (!(q === name || q === core || (core.length >= 2 && core.includes(q)))) return null;
        return {
            name,
            intro: cf?.shopIntro ? String(cf.shopIntro) : null,
            url: this.shopUrlOf(cf),
        };
    }

    /** 3km 门店列表项 → 客服联系方式（门店数据回查失败时兜底用） */
    private contactFromNearby(store?: NearbyStore | null): StoreContact | null {
        if (!store) return null;
        return {
            id: store.id,
            name: store.name,
            address: store.address,
            phoneNumber: store.phoneNumber ?? null,
            businessHours: store.businessHours ?? null,
        };
    }

    // ============ 留言工单（≤200 字落库，后台回复经公众号下发） ============

    /** 「留言」入口：进入留言输入态，并记住当前流程状态（保存/取消后恢复） */
    private async handleSupportNoteStart(
        msg: WechatInboundMessage,
        session: WechatShoppingSession | null,
    ): Promise<OutboundMessage> {
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const channelId = session?.channelId ?? (await this.resolveChannelId(msg.channelToken));
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        await this.sessionService.setFlow(
            msg.fromUserName,
            'support_note',
            {
                ...(session?.draft ?? {}),
                supportReturnState: (session?.state as AssistantFlowState | null) ?? null,
            },
            ttl,
        );
        Logger.info(
            `Assistant support note started: openid=${msg.fromUserName} returnState=${session?.state ?? 'none'}`,
            loggerCtx,
        );
        return buildSupportNotePromptText(msg.fromUserName);
    }

    /** 留言正文：校验长度 → 落库工单 → 恢复原流程状态 */
    private async onSupportNote(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
    ): Promise<OutboundMessage | null> {
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const text = (msg.content || '').trim();
        const draft: AssistantFlowDraft = session.draft ?? {};

        // 取消：放弃留言并恢复留言前的流程状态
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.setFlow(
                msg.fromUserName,
                draft.supportReturnState ?? null,
                { ...draft, supportReturnState: null },
                ttl,
            );
            return buildSupportNoteCancelledText(msg.fromUserName);
        }
        if (text.length > 200) {
            return buildSupportNoteTooLongText(msg.fromUserName, text.length);
        }

        const channelId = session.channelId ?? (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        const store = await this.resolveSupportStore(ctx, draft);
        let ticketId: string;
        try {
            const ticket = await this.supportTickets.create(ctx, {
                openid: msg.fromUserName,
                channelId: Number(channelId),
                customerId: customer ? Number(customer.id) : null,
                storeId: store?.id ?? null,
                storeName: store?.name ?? null,
                summary: this.supportSummary(session, draft),
                content: text,
            });
            ticketId = String(ticket.id);
            Logger.info(`Assistant support note saved: openid=${msg.fromUserName} ticket=${ticketId}`, loggerCtx);
        } catch (e) {
            Logger.error(`Assistant support note save failed: ${String(e)}`, loggerCtx);
            // 落库失败保留输入态，用户可重发或取消
            return {
                kind: 'text',
                touser: msg.fromUserName,
                content: '留言提交失败，请稍后重试一次；也可回复「客服」直接电话联系。',
            };
        }

        await this.sessionService.setFlow(
            msg.fromUserName,
            draft.supportReturnState ?? null,
            { ...draft, supportReturnState: null },
            ttl,
        );
        return buildSupportNoteSavedText(msg.fromUserName, ticketId);
    }

    /** 留言关联门店：最近客服门店 → 已选门店 → 3km 唯一候选 */
    private async resolveSupportStore(
        ctx: RequestContext,
        draft: AssistantFlowDraft,
    ): Promise<{ id: string; name: string | null } | null> {
        const single = draft.nearbyStores?.length === 1 ? draft.nearbyStores[0] : null;
        const storeId = draft.supportStoreId ?? draft.storeId ?? single?.id ?? null;
        if (!storeId) return null;
        const cached = draft.nearbyStores?.find(store => store.id === storeId);
        if (cached?.name) return { id: storeId, name: cached.name };
        try {
            const contact = await this.storeLocator.findContact(ctx, storeId);
            return { id: storeId, name: contact?.name ?? null };
        } catch {
            return { id: storeId, name: null };
        }
    }

    /** 工单上下文摘要：当前这单商品/合计 + 城市（便于客服定位问题） */
    private supportSummary(session: WechatShoppingSession, draft: AssistantFlowDraft): string | null {
        const parts: string[] = [];
        const picked = (session.results ?? []).filter(r => (draft.indices ?? []).includes(r.index));
        if (picked.length) {
            const items = picked.map(r => `${r.title} ×${r.quantity ?? 1}`).join('，');
            const total = picked.reduce((sum, r) => sum + r.price * (r.quantity ?? 1), 0);
            parts.push(`商品：${items}，合计 ${formatPrice(total)}`);
        }
        if (draft.city) parts.push(`城市：${draft.city}`);
        return parts.length ? parts.join('；').slice(0, 500) : null;
    }

    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导；并按渠道配置选支付方式 */
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

        // 支付方式完全由渠道配置驱动：0 个不建单；1 个自动选中；≥2 个先让用户选
        const ttl = this.opts.sessionTtlMinutes ?? 30;
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            await this.sessionService.clearFlow(touser);
            Logger.info(`Assistant no payment method: channel=${session.channelId}`, loggerCtx);
            return buildNoPaymentMethodText(touser);
        }
        const current = methods.find(m => m.code === draft.paymentMethodCode);
        if (!current && methods.length > 1) {
            await this.sessionService.setFlow(
                touser,
                'pay_pick',
                { ...draft, paymentMethodCode: null, paymentMethods: methods },
                ttl,
            );
            return buildPaymentPickText(touser, methods);
        }
        const selected = current ?? methods[0];
        return buildOrderConfirmCard(touser, {
            items: picked.map(p => ({ title: p.title, quantity: p.quantity ?? 1, price: p.price })),
            total: picked.reduce((s, p) => s + p.price * (p.quantity ?? 1), 0),
            address,
            payment: { name: selected.name, canSwitch: methods.length > 1 },
        });
    }

    /** pay_pick：回复编号选支付方式 → 回下单确认；0 返回地址列表 */
    private async onPayPick(
        msg: WechatInboundMessage,
        session: WechatShoppingSession,
        text: string,
        draft: AssistantFlowDraft,
        ttl: number,
    ): Promise<OutboundMessage> {
        const ctx = await this.createShopCtx(session.channelId);
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return buildNoPaymentMethodText(msg.fromUserName);
        }
        const input = normalizeInput(text);
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
        const n = /^\d{1,2}$/.test(input) ? Number(input) : 0;
        if (n < 1 || n > methods.length) {
            return buildPaymentPickText(msg.fromUserName, methods);
        }
        const selected = methods[n - 1];
        const nextDraft: AssistantFlowDraft = {
            ...draft,
            paymentMethodCode: selected.code,
            paymentMethods: methods,
        };
        await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', nextDraft, ttl);
        Logger.info(
            `Assistant payment method selected: ${selected.code} openid=${msg.fromUserName}`,
            loggerCtx,
        );
        return this.orderConfirmCard(ctx, msg.fromUserName, session, nextDraft);
    }

    /** 「支付方式」查询：按当前渠道配置列出（不改变会话状态） */
    private async handlePaymentMethodsInfo(
        msg: WechatInboundMessage,
        session: WechatShoppingSession | null,
    ): Promise<OutboundMessage> {
        const channelId = session?.channelId ?? (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const methods = await this.orderService.listPaymentMethods(ctx);
        return methods.length
            ? buildPaymentMethodsInfoText(msg.fromUserName, methods)
            : buildNoPaymentMethodText(msg.fromUserName);
    }

    // ============ 搜索：meili 检索 → 会话保存 → 卡片消息 ============

    private async handleSearch(
        msg: WechatInboundMessage,
        query: string,
        quantity: number,
    ): Promise<OutboundMessage | null> {
        const channelId = await this.resolveChannelId(msg.channelToken);
        // 店铺名/简称（如「利民」）优先回店铺信息，避免正文里带店铺名导致全店泛匹配
        const ctx = await this.createShopCtx(channelId);
        const shop = this.matchShopQuery(query, (ctx.channel?.customFields as any) ?? {});
        if (shop) {
            Logger.info(`Assistant shop info: openid=${msg.fromUserName} query=${query}`, loggerCtx);
            return buildShopInfoCard(msg.fromUserName, shop);
        }
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
        payment?: { code: string; name: string },
    ): Promise<OutboundMessage> {
        // 渠道未配置可用支付方式 → 不建单（后台关闭后下一次会话立即生效）
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            Logger.info(`Assistant order blocked: no payment method channel=${ctx.channelId}`, loggerCtx);
            return buildNoPaymentMethodText(touser);
        }
        const selected =
            payment && methods.some(m => m.code === payment.code) ? payment : methods[0];
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
        // 城市路由：解析地址 → 匹配租户 → 切换或校验范围（可用 ASSISTANT_CITY_ROUTING=off 关闭）
        const routingOn = process.env.ASSISTANT_CITY_ROUTING !== 'off';
        if (routingOn && addrItem?.streetLine1) {
            const parsed = await this.deliveryGuard.parse(ctx, addrItem.streetLine1);
            if (!parsed) {
                return buildOrderFailText(touser, '配送校验暂时不可用，请稍后再试');
            }
            const route = await this.tenantRouter.resolve(ctx, {
                cityCode: parsed.cityCode,
                currentChannelId: String(ctx.channelId),
                lat: parsed.lat,
                lng: parsed.lng,
            });
            // 排序第一的渠道不是当前渠道 → 切店（当前渠道即使也在候选内，精度/优先级更低时也要让位）
            const target =
                route.chosen && route.chosen.channelId !== String(ctx.channelId) ? route.chosen : null;
            if (target) {
                // 切店：用原关键词在新渠道重搜，结果写回会话（channelId 一并切换），让用户重新回编号
                const session = await this.sessionService.getActive(touser);
                const query = session?.query?.trim() ?? '';
                await this.sessionService.saveDraft(
                    touser,
                    { cityCode: parsed.cityCode, resolvedChannelId: target.channelId, pendingQuery: query || null },
                    this.opts.sessionTtlMinutes ?? 30,
                );
                if (query) {
                    try {
                        const hits = await this.searchService.searchProducts({
                            query,
                            channelId: target.channelId,
                            locale: this.opts.searchLocale ?? 'zh',
                            limit: this.opts.searchLimit ?? 5,
                            storefrontUrl: this.storefront(),
                            productUrlTemplate: this.opts.productUrlTemplate,
                        });
                        if (hits.length) {
                            await this.sessionService.saveResults(
                                touser,
                                target.channelId,
                                hits.map(h => ({ ...h, quantity: picked[0]?.quantity ?? 1 })),
                                query,
                                this.opts.sessionTtlMinutes ?? 30,
                            );
                        }
                    } catch (e) {
                        Logger.warn(`Assistant switch-channel search failed: ${String(e)}`, loggerCtx);
                    }
                }
                await this.sessionService.clearFlow(touser);
                Logger.info(
                    `Assistant channel switched: ${ctx.channelId} → ${target.channelId} city=${parsed.cityCode}`,
                    loggerCtx,
                );
                return buildChannelSwitchText(touser, target.channelName);
            }
            const guard = await this.deliveryGuard.checkParsed(ctx, String(ctx.channelId), parsed);
            if (guard.status === 'UNKNOWN') {
                return buildOrderFailText(touser, '配送校验暂时不可用，请稍后再试');
            }
            if (guard.status === 'OUT_OF_RANGE') {
                return buildOutOfRangeText(touser, {
                    address: addrItem.streetLine1,
                    serviceAreaText: guard.serviceAreaText,
                    channelName: await this.channelName(String(ctx.channelId)),
                });
            }
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
                    paymentName: selected.name,
                    etaMinutes: await this.channelDeliveryMinutes(String(ctx.channelId)),
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

    /** 渠道展示名：装修 shopName → channel.code */
    private async channelName(channelId: string): Promise<string | null> {
        const ch = await this.connection.getRepository(Channel).findOne({ where: { id: channelId as any } });
        const cf = (ch?.customFields ?? {}) as any;
        return cf.shopName ? String(cf.shopName) : ch?.code ?? null;
    }

    /** 渠道预计送达分钟数（未配置返回 null → 文案提示电话确认） */
    private async channelDeliveryMinutes(channelId: string): Promise<number | null> {
        const ch = await this.connection.getRepository(Channel).findOne({ where: { id: channelId as any } });
        const cf = (ch?.customFields ?? {}) as any;
        return cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null;
    }

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

/** 微信位置坐标 + 逆地理行政区 → 可写入草稿/地址的坐标对象 */
function geoPointFromReverse(
    reverse: ReverseAddressResult,
    lat: number,
    lng: number,
): AssistantAddressGeo {
    return {
        lat,
        lng,
        province: reverse.province,
        city: reverse.city,
        district: reverse.district,
        // 用户主动共享的 GPS 位置，视为兴趣点级精度（非门牌号）
        level: 'poi',
    };
}
