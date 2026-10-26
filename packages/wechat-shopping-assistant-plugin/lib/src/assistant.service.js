"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const address_service_1 = require("./address.service");
const card_builder_1 = require("./card-builder");
const delivery_guard_service_1 = require("./city/delivery-guard.service");
const tenant_router_service_1 = require("./city/tenant-router.service");
const constants_1 = require("./constants");
const credential_service_1 = require("./credential.service");
const customer_binding_service_1 = require("./customer-binding.service");
const wechat_processed_message_entity_1 = require("./entities/wechat-processed-message.entity");
const geo_service_1 = require("./geo.service");
const intent_1 = require("./intent");
const order_service_1 = require("./order.service");
const search_adapter_1 = require("./search-adapter");
const session_service_1 = require("./session.service");
const store_locator_service_1 = require("./store-locator.service");
const support_ticket_service_1 = require("./support-ticket.service");
const wechat_sender_1 = require("./wechat-sender");
/** 同一门店「客服」重复请求窗口：窗口内只回短提示，避免刷屏（PRD FR-07） */
const SUPPORT_REPEAT_WINDOW_MS = 10 * 60 * 1000;
/**
 * 微信购物助手编排器：
 * 回调事件（WechatMessageEvent）→ 去重 → 意图识别 → 搜索/下单 → 客服消息回复。
 * 全链路异步执行且吞掉异常（回调 5 秒内已回 success，超时微信会重试，
 * 重复推送由 MsgId 去重表挡住）。
 */
let AssistantService = class AssistantService {
    constructor(opts, connection, sessionService, searchService, orderService, sender, credentialService, channelService, requestContextService, customerBinding, addressBook, geoService, storeLocator, supportTickets, deliveryGuard, tenantRouter) {
        this.opts = opts;
        this.connection = connection;
        this.sessionService = sessionService;
        this.searchService = searchService;
        this.orderService = orderService;
        this.sender = sender;
        this.credentialService = credentialService;
        this.channelService = channelService;
        this.requestContextService = requestContextService;
        this.customerBinding = customerBinding;
        this.addressBook = addressBook;
        this.geoService = geoService;
        this.storeLocator = storeLocator;
        this.supportTickets = supportTickets;
        this.deliveryGuard = deliveryGuard;
        this.tenantRouter = tenantRouter;
    }
    async onMessage(event) {
        const msg = event.message;
        try {
            await this.handle(msg);
        }
        catch (e) {
            core_1.Logger.error(`Assistant handle message failed: ${String(e)}`, constants_1.loggerCtx);
        }
    }
    /** 事件总线链路（本插件回调直连微信时用）：去重 → 决策 → 客服消息发送 */
    async handle(msg) {
        if (!(await this.claimInboundDedup(msg)))
            return;
        const out = await this.processMessage(msg);
        if (!out)
            return;
        const credentials = await this.credentialService.resolveForChannel(msg.channelToken, {});
        try {
            await this.sender.send(out, credentials);
        }
        catch (e) {
            core_1.Logger.error(`Assistant reply failed: ${String(e)}`, constants_1.loggerCtx);
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
    async processMessage(msg, extra) {
        var _a, _b, _c, _d;
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本/位置）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? (0, card_builder_1.buildWelcomeText)(msg.fromUserName) : null;
        }
        if (msg.msgType === 'location')
            return this.handleLocationMessage(msg);
        if (msg.msgType !== 'text' || !msg.content)
            return null;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        // 留言输入态：这句话就是留言正文，不再识别指令（取消例外，见 onSupportNote）
        if ((session === null || session === void 0 ? void 0 : session.state) === 'support_note')
            return this.onSupportNote(msg, session);
        // 全局「一键客服 / 留言 / 支付方式」：任何状态下优先响应，不打断原流程
        const earlyIntent = (0, intent_1.recognizeIntent)(msg.content);
        if (earlyIntent.kind === 'support')
            return this.handleSupport(msg, earlyIntent.storeIndex);
        if (earlyIntent.kind === 'support_note')
            return this.handleSupportNoteStart(msg, session);
        if (earlyIntent.kind === 'payment_methods')
            return this.handlePaymentMethodsInfo(msg, session);
        // 补录状态机优先：处于手机号/地址补录中的用户，输入不走意图识别
        if (session === null || session === void 0 ? void 0 : session.state) {
            return this.handleFlowStep(msg, session);
        }
        // 空闲态定位后回复「门店N」：回查最近一次门店列表选用（不额外占用会话状态）
        if (((_c = (_b = session === null || session === void 0 ? void 0 : session.draft) === null || _b === void 0 ? void 0 : _b.nearbyStores) === null || _c === void 0 ? void 0 : _c.length) && /^门店\d{1,2}[!！。.~]?$/.test((0, intent_1.normalizeInput)(msg.content))) {
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
                core_1.Logger.info(`Assistant flow awaiting_address (bare phone) openid=${msg.fromUserName}`, constants_1.loggerCtx);
                return (0, card_builder_1.buildAwaitingAddressText)(msg.fromUserName, phone);
            }
            // 已绑定用户发手机号：继续走搜索意图（罕见，不拦截）
        }
        const intent = (0, intent_1.recognizeIntent)(msg.content);
        core_1.Logger.info(`Assistant intent=${intent.kind} from=${msg.fromUserName}`, constants_1.loggerCtx);
        switch (intent.kind) {
            case 'help':
                return (0, card_builder_1.buildGuideText)(msg.fromUserName, this.storefront());
            case 'bind': {
                const bound = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
                if (bound) {
                    return {
                        kind: 'text',
                        touser: msg.fromUserName,
                        content: '您的微信已绑定购物账号，直接发商品名即可下单（如「买一瓶酱油」）。',
                    };
                }
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            case 'search':
                return this.handleSearch(msg, intent.query, (_d = intent.quantity) !== null && _d !== void 0 ? _d : 1);
            case 'order':
                return this.handleOrder(msg, intent.indices, extra === null || extra === void 0 ? void 0 : extra.boundPhone);
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
    async handleFlowStep(msg, session) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        const text = (msg.content || '').trim();
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return (0, card_builder_1.buildFlowCancelledText)(msg.fromUserName);
        }
        // 地址流程态（addr_* / order_confirm）放行显式指令（状态机优先但指令不放行会成死胡同：
        // 重发「地址管理」被当无效编号；「买N」无法重新下单；补录态（awaiting_*）不放行）。
        // 新增入口保留 order 流程上下文。
        const inAddrFlow = ((_a = session.state) === null || _a === void 0 ? void 0 : _a.startsWith('addr_')) ||
            session.state === 'order_confirm' ||
            session.state === 'pay_pick';
        if (inAddrFlow) {
            const flowIntent = (0, intent_1.recognizeIntent)(text);
            if (flowIntent.kind === 'address_manage')
                return this.handleAddressManage(msg);
            if (flowIntent.kind === 'address_add') {
                const sessionNow = await this.sessionService.getActive(msg.fromUserName);
                const keepFlow = ((_b = sessionNow === null || sessionNow === void 0 ? void 0 : sessionNow.draft) === null || _b === void 0 ? void 0 : _b.flow) === 'order' ? sessionNow.draft : { flow: 'manage' };
                return this.handleAddressAdd(msg, keepFlow);
            }
            // 显式「买N」（带引导词）= 重新开始下单（重列地址选址）；
            // 纯数字「1」在地址流态是编号回复（选地址/菜单项），不放行
            const explicitOrder = flowIntent.kind === 'order' && /^(?:购买|下单|订购|买|要|来|购|拍)/.test((0, intent_1.normalizeInput)(text));
            if (explicitOrder)
                return this.handleOrder(msg, flowIntent.indices);
            if (flowIntent.kind === 'nearby_stores')
                return (0, card_builder_1.buildStoreFlowBusyText)(msg.fromUserName);
        }
        const ttl = (_c = this.opts.sessionTtlMinutes) !== null && _c !== void 0 ? _c : 30;
        const draft = (_d = session.draft) !== null && _d !== void 0 ? _d : {};
        // 门店选择态可重新拉取附近门店（城市/位置可能已更新）
        if (session.state === 'store_pick' && (0, intent_1.recognizeIntent)(text).kind === 'nearby_stores') {
            return this.handleNearbyStores(msg);
        }
        if (session.state === 'awaiting_phone') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return (0, card_builder_1.buildInvalidPhoneText)(msg.fromUserName);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'awaiting_address', { phone, indices: (_e = draft.indices) !== null && _e !== void 0 ? _e : [] }, ttl);
            core_1.Logger.info(`Assistant flow awaiting_address openid=${msg.fromUserName}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildAwaitingAddressText)(msg.fromUserName, phone);
        }
        if (session.state === 'awaiting_address') {
            if (text.length < 8) {
                return (0, card_builder_1.buildInvalidAddressText)(msg.fromUserName);
            }
            const phone = draft.phone;
            if (!phone) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            // 建档前先取待下单编号（清态后 draft 即失效）
            const indices = (_f = draft.indices) !== null && _f !== void 0 ? _f : [];
            const picked = session.results.filter(r => indices.includes(r.index));
            const ctx = await this.createShopCtx(session.channelId);
            // 建档首地址：地理编码失败不阻塞建档，仅少写坐标（后续可在地址簿补录）
            const geo = await this.geoService.geocode(ctx, text);
            const outcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, phone, text, geo);
            await this.sessionService.clearFlow(msg.fromUserName);
            switch (outcome.status) {
                case 'ok': {
                    if (!picked.length)
                        return (0, card_builder_1.buildBindSuccessText)(msg.fromUserName);
                    // 建档首地址即默认地址，placeOrder 内自动取默认地址落单
                    return this.placeOrder(ctx, msg.fromUserName, outcome.customer, picked);
                }
                case 'phone_taken':
                    return (0, card_builder_1.buildPhoneTakenText)(msg.fromUserName, this.loginUrl());
                default:
                    return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, outcome.message);
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
            const input = (0, intent_1.normalizeInput)(text);
            if (input === '1') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_text', draft, ttl);
                return (0, card_builder_1.buildAddrEditTextPrompt)(msg.fromUserName);
            }
            if (input === '2') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_person', draft, ttl);
                return (0, card_builder_1.buildAddrEditPersonPrompt)(msg.fromUserName);
            }
            return (0, card_builder_1.buildAddrEditFieldText)(msg.fromUserName, (_g = draft.pickIndex) !== null && _g !== void 0 ? _g : 0);
        }
        if (session.state === 'addr_edit_text') {
            if (text.length < 8) {
                return (0, card_builder_1.buildInvalidAddressText)(msg.fromUserName);
            }
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome)
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            const geo = await this.geoService.geocode(outcome.ctx, text);
            const geoFields = geo
                ? { latitude: geo.lat, longitude: geo.lng, province: geo.province, city: geo.city }
                : undefined;
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, text, geoFields);
            if (!ok)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '修改地址失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildAddrSavedText)(msg.fromUserName, updated);
        }
        if (session.state === 'addr_edit_person') {
            // 「姓名 电话」一行（姓名取最后一个空格前的全部，支持英文姓名）；只发号码 = 只改电话
            let fullName;
            let phone;
            const bare = text.replace(/[-\s]/g, '');
            const m = text.match(/^(.+)\s+(1[3-9]\d{9})$/);
            if (/^1[3-9]\d{9}$/.test(bare)) {
                phone = bare;
            }
            else if (m) {
                fullName = m[1].trim().slice(0, 50);
                phone = m[2];
            }
            else {
                return (0, card_builder_1.buildInvalidAddrPersonText)(msg.fromUserName);
            }
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome)
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updatePerson(outcome.ctx, outcome.addressId, {
                fullName,
                phoneNumber: phone,
            });
            if (!ok)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '修改收货人信息失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildAddrSavedText)(msg.fromUserName, updated);
        }
        if (session.state === 'addr_del_confirm') {
            const input = (0, intent_1.normalizeInput)(text);
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome)
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            const item = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            if (!item) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                return (0, card_builder_1.buildInvalidAddrIndexText)(msg.fromUserName, 1);
            }
            if (input === '1') {
                const ok = await this.addressBook.remove(outcome.ctx, outcome.addressId);
                if (!ok)
                    return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '删除地址失败');
                const remaining = await this.addressBook.list(outcome.ctx, outcome.customerId);
                // core 已把默认顶替给剩余最早地址；仅当删的是默认时展示切换/无默认提示
                const newDefault = item.isDefault ? ((_h = remaining.find(a => a.isDefault)) !== null && _h !== void 0 ? _h : null) : undefined;
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                core_1.Logger.info(`Assistant address removed: addressId=${outcome.addressId} wasDefault=${item.isDefault}`, constants_1.loggerCtx);
                return (0, card_builder_1.buildAddrDeletedText)(msg.fromUserName, newDefault);
            }
            if (input === '0') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
                const items = await this.addressBook.list(outcome.ctx, outcome.customerId);
                return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, items, 'manage');
            }
            return (0, card_builder_1.buildAddrDeleteConfirm)(msg.fromUserName, item);
        }
        if (session.state === 'addr_new_text') {
            if (text.length < 8) {
                return (0, card_builder_1.buildInvalidAddressText)(msg.fromUserName);
            }
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const nextDraft = Object.assign(Object.assign({}, draft), { pendingText: text.slice(0, 250) });
            const geo = await this.geoService.geocode(await this.createShopCtx(session.channelId), text, this.geoHint(draft));
            nextDraft.geo = geo;
            const registeredPhone = (_j = customer.phoneNumber) !== null && _j !== void 0 ? _j : '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', nextDraft, ttl);
                return (0, card_builder_1.buildAddrNewPhoneText)(msg.fromUserName, registeredPhone);
            }
            // 无注册手机号：跳过选择直接收号码
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', nextDraft, ttl);
            return (0, card_builder_1.buildAddrNewPhonePromptText)(msg.fromUserName);
        }
        if (session.state === 'addr_new_phone') {
            const input = (0, intent_1.normalizeInput)(text);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            const registeredPhone = (_k = customer === null || customer === void 0 ? void 0 : customer.phoneNumber) !== null && _k !== void 0 ? _k : '';
            if (input === '1' && registeredPhone) {
                if (!draft.pendingText) {
                    await this.sessionService.clearFlow(msg.fromUserName);
                    return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
                }
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_default', Object.assign(Object.assign({}, draft), { pendingPhone: registeredPhone }), ttl);
                return (0, card_builder_1.buildAddrNewDefaultText)(msg.fromUserName, draft.pendingText, registeredPhone);
            }
            if (input === '2' || (input === '1' && !registeredPhone)) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', draft, ttl);
                return (0, card_builder_1.buildAddrNewPhonePromptText)(msg.fromUserName);
            }
            return (0, card_builder_1.buildAddrNewPhoneText)(msg.fromUserName, registeredPhone || undefined);
        }
        if (session.state === 'addr_new_phone_text') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return (0, card_builder_1.buildInvalidPhoneText)(msg.fromUserName);
            }
            if (!draft.pendingText) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_default', Object.assign(Object.assign({}, draft), { pendingPhone: phone }), ttl);
            return (0, card_builder_1.buildAddrNewDefaultText)(msg.fromUserName, draft.pendingText, phone);
        }
        if (session.state === 'addr_new_default') {
            const input = (0, intent_1.normalizeInput)(text);
            if (input !== '是' && input !== '否') {
                return (0, card_builder_1.buildAddrNewDefaultText)(msg.fromUserName, (_l = draft.pendingText) !== null && _l !== void 0 ? _l : '', (_m = draft.pendingPhone) !== null && _m !== void 0 ? _m : '');
            }
            const ctx = await this.createShopCtx(session.channelId);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const addressId = await this.addressBook.add(ctx, customer.id, Object.assign({ streetLine1: (_o = draft.pendingText) !== null && _o !== void 0 ? _o : '', phoneNumber: (_p = draft.pendingPhone) !== null && _p !== void 0 ? _p : '', setDefault: input === '是' }, (draft.geo
                ? {
                    province: draft.geo.province,
                    city: draft.geo.city,
                    latitude: draft.geo.lat,
                    longitude: draft.geo.lng,
                }
                : {})));
            if (!addressId)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '保存地址失败');
            const item = await this.addressBook.getItem(ctx, customer.id, addressId);
            core_1.Logger.info(`Assistant address added: addressId=${addressId} flow=${(_q = draft.flow) !== null && _q !== void 0 ? _q : 'manage'}`, constants_1.loggerCtx);
            // 下单流程：新地址直接进下单确认；管理流程：落库后回列表态
            if (draft.flow === 'order') {
                await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', Object.assign(Object.assign({}, draft), { pickAddressId: addressId }), ttl);
                return this.orderConfirmCard(ctx, msg.fromUserName, session, Object.assign(Object.assign({}, draft), { pickAddressId: addressId }));
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildAddrSavedText)(msg.fromUserName, item);
        }
        if (session.state === 'pay_pick') {
            return this.onPayPick(msg, session, text, draft, ttl);
        }
        if (session.state === 'order_confirm') {
            const input = (0, intent_1.normalizeInput)(text);
            const ctx = await this.createShopCtx(session.channelId);
            if (input === '0') {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', Object.assign(Object.assign({}, draft), { pickIndex: null, pickAddressId: null }), ttl);
                const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
                if (!customer) {
                    await this.sessionService.clearFlow(msg.fromUserName);
                    return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
                }
                const items = await this.addressBook.list(ctx, customer.id);
                return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, items, 'order');
            }
            // 换支付方式：仅 ≥2 个可用时有意义
            const methods = await this.orderService.listPaymentMethods(ctx);
            if (!methods.length) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildNoPaymentMethodText)(msg.fromUserName);
            }
            if (input === '9' && methods.length > 1) {
                await this.sessionService.setFlow(msg.fromUserName, 'pay_pick', Object.assign(Object.assign({}, draft), { paymentMethodCode: null, paymentMethods: methods }), ttl);
                return (0, card_builder_1.buildPaymentPickText)(msg.fromUserName, methods);
            }
            if (input !== '1') {
                return this.orderConfirmCard(ctx, msg.fromUserName, session, draft);
            }
            // 确认时点复核：选中的支付方式可能刚被后台关闭
            const selected = (_r = methods.find(m => m.code === draft.paymentMethodCode)) !== null && _r !== void 0 ? _r : methods[0];
            if (draft.paymentMethodCode && !methods.some(m => m.code === draft.paymentMethodCode)) {
                const closedName = (_u = (_t = (_s = draft.paymentMethods) === null || _s === void 0 ? void 0 : _s.find(m => m.code === draft.paymentMethodCode)) === null || _t === void 0 ? void 0 : _t.name) !== null && _u !== void 0 ? _u : draft.paymentMethodCode;
                await this.sessionService.setFlow(msg.fromUserName, 'pay_pick', Object.assign(Object.assign({}, draft), { paymentMethodCode: null, paymentMethods: methods }), ttl);
                return (0, card_builder_1.buildPaymentPickText)(msg.fromUserName, methods, `「${closedName}」刚关闭了，当前可用：`);
            }
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const picked = session.results.filter(r => { var _a; return ((_a = draft.indices) !== null && _a !== void 0 ? _a : []).includes(r.index); });
            if (!picked.length) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildSessionExpiredText)(msg.fromUserName);
            }
            const out = await this.placeOrder(ctx, msg.fromUserName, customer, picked, (_v = draft.pickAddressId) !== null && _v !== void 0 ? _v : undefined, selected);
            await this.sessionService.clearFlow(msg.fromUserName);
            return out;
        }
        return null;
    }
    /**
     * 管理态分支公共上下文：ctx + 顾客 + 选定地址 id；顾客失效返回 null（调用方回绑定引导）。
     * 地址已被删除（列表变动）时 addressId 仍在草稿中，由 getItem 返回 null 让调用方回列表态。
     */
    async withAddrCtx(msg, draft) {
        var _a;
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer || !draft.pickAddressId)
            return null;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const ctx = await this.createShopCtx((_a = session === null || session === void 0 ? void 0 : session.channelId) !== null && _a !== void 0 ? _a : '1');
        return { ctx, customerId: String(customer.id), addressId: draft.pickAddressId };
    }
    /** addr_pick：回复编号选址（order → 下单确认 / manage → 操作菜单），0/「新增」进新增流程 */
    async onAddrPick(msg, session, text, draft, ttl) {
        const input = (0, intent_1.normalizeInput)(text);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        }
        const ctx = await this.createShopCtx(session.channelId);
        const items = await this.addressBook.list(ctx, customer.id);
        if (input === '0' || input === '新增' || input === '添加') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', draft, ttl);
            return (0, card_builder_1.buildAddrEditTextPrompt)(msg.fromUserName);
        }
        const n = /^\d{1,2}$/.test(input) ? Number(input) : 0;
        if (n < 1 || n > items.length) {
            return (0, card_builder_1.buildInvalidAddrIndexText)(msg.fromUserName, Math.max(items.length, 1));
        }
        const item = items[n - 1];
        if (draft.flow === 'manage') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_op', Object.assign(Object.assign({}, draft), { pickIndex: n, pickAddressId: item.id }), ttl);
            return (0, card_builder_1.buildAddrOpMenu)(msg.fromUserName, item);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', Object.assign(Object.assign({}, draft), { pickIndex: n, pickAddressId: item.id }), ttl);
        return this.orderConfirmCard(ctx, msg.fromUserName, session, Object.assign(Object.assign({}, draft), { pickAddressId: item.id }));
    }
    /** addr_op：管理态操作菜单（1 设默认 / 2 修改 / 3 删除 / 0 返回列表） */
    async onAddrOp(msg, session, text, draft, ttl) {
        const input = (0, intent_1.normalizeInput)(text);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        const ctx = await this.createShopCtx(session.channelId);
        const addressId = draft.pickAddressId;
        const item = customer && addressId ? await this.addressBook.getItem(ctx, customer.id, addressId) : null;
        if (!customer || !item) {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildInvalidAddrIndexText)(msg.fromUserName, 1);
        }
        if (input === '1') {
            const ok = await this.addressBook.setDefault(ctx, item.id);
            if (!ok)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '设置默认地址失败');
            const updated = await this.addressBook.getItem(ctx, customer.id, item.id);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            core_1.Logger.info(`Assistant address default set: addressId=${item.id}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildAddrDefaultSetText)(msg.fromUserName, updated !== null && updated !== void 0 ? updated : item);
        }
        if (input === '2') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_edit_field', draft, ttl);
            return (0, card_builder_1.buildAddrEditFieldText)(msg.fromUserName, item.index);
        }
        if (input === '3') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_del_confirm', draft, ttl);
            return (0, card_builder_1.buildAddrDeleteConfirm)(msg.fromUserName, item);
        }
        if (input === '0') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            const items = await this.addressBook.list(ctx, customer.id);
            return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, items, 'manage');
        }
        return (0, card_builder_1.buildAddrOpMenu)(msg.fromUserName, item);
    }
    /** 「地址管理」入口：列地址簿 → addr_pick（manage 态） */
    async handleAddressManage(msg) {
        var _a;
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer)
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const ctx = await this.createShopCtx(channelId);
        const items = await this.addressBook.list(ctx, customer.id);
        await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
        core_1.Logger.info(`Assistant address book opened: customerId=${customer.id} count=${items.length}`, constants_1.loggerCtx);
        return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, items, 'manage');
    }
    /** 「新增地址」入口：直接进新增地址文本状态（默认 manage 流程；下单流程传入保留 order 上下文） */
    async handleAddressAdd(msg, initialDraft = { flow: 'manage' }) {
        var _a, _b, _c, _d, _e, _f, _g;
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer)
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const session = await this.sessionService.getActive(msg.fromUserName);
        // 空闲态发过位置：直接复用缓存的定位地址，跳过地址文本输入
        const locatedText = (_d = (_c = (_b = session === null || session === void 0 ? void 0 : session.draft) === null || _b === void 0 ? void 0 : _b.pendingText) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        const locatedGeo = (_f = (_e = session === null || session === void 0 ? void 0 : session.draft) === null || _e === void 0 ? void 0 : _e.geo) !== null && _f !== void 0 ? _f : null;
        if (locatedText.length >= 8 && locatedGeo) {
            const draft = Object.assign(Object.assign({}, initialDraft), { pendingText: locatedText, geo: locatedGeo });
            const registeredPhone = (_g = customer.phoneNumber) !== null && _g !== void 0 ? _g : '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', draft, ttl);
                return (0, card_builder_1.buildAddrNewPhoneText)(msg.fromUserName, registeredPhone);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', draft, ttl);
            return (0, card_builder_1.buildAddrNewPhonePromptText)(msg.fromUserName);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', initialDraft, ttl);
        return (0, card_builder_1.buildAddrEditTextPrompt)(msg.fromUserName);
    }
    // ============ 位置消息：逆地理 → 按会话态写入地址 ============
    /**
     * 微信「发送位置」消息：
     * - 空闲态：缓存定位结果（「新增地址」可直接复用），不改变会话状态；
     * - 地址录入态（awaiting_address / addr_new_text / addr_edit_text）：直接作为收货地址写入；
     * - 其他状态：提示先完成当前步骤，不打断流程。
     */
    async handleLocationMessage(msg) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const lat = Number(msg.latitude);
        const lng = Number(msg.longitude);
        if (!geo_service_1.GeoService.isValidCoordinate(lat, lng)) {
            return (0, card_builder_1.buildLocationInvalidText)(msg.fromUserName);
        }
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const state = ((_b = session === null || session === void 0 ? void 0 : session.state) !== null && _b !== void 0 ? _b : null);
        const addressInputStates = ['awaiting_address', 'addr_new_text', 'addr_edit_text'];
        if (state && !addressInputStates.includes(state)) {
            core_1.Logger.info(`Assistant location ignored in state=${state} openid=${msg.fromUserName}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildLocationFlowBusyText)(msg.fromUserName);
        }
        const channelId = (_c = session === null || session === void 0 ? void 0 : session.channelId) !== null && _c !== void 0 ? _c : (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const reverse = await this.geoService.reverse(ctx, lat, lng);
        if (!reverse)
            return (0, card_builder_1.buildLocationUnavailableText)(msg.fromUserName);
        const addressText = geo_service_1.GeoService.composeAddressText(reverse, msg.label);
        if (addressText.length < 8) {
            core_1.Logger.info(`Assistant location address too short: openid=${msg.fromUserName}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildLocationUnavailableText)(msg.fromUserName);
        }
        const geo = geoPointFromReverse(reverse, lat, lng);
        // 空闲态：缓存定位 + 识别城市 + 匹配 3km 门店，供「新增地址」「附近门店」直接使用
        if (!state) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            const nearbyStores = await this.matchStores(ctx, msg.fromUserName, lat, lng);
            await this.sessionService.saveDraft(msg.fromUserName, Object.assign(Object.assign({}, ((_d = session === null || session === void 0 ? void 0 : session.draft) !== null && _d !== void 0 ? _d : {})), { pendingText: addressText.slice(0, 250), geo, city: (_e = reverse.city) !== null && _e !== void 0 ? _e : null, nearbyStores }), ttl);
            core_1.Logger.info(`Assistant location cached: openid=${msg.fromUserName} city=${(_f = reverse.city) !== null && _f !== void 0 ? _f : ''} stores=${nearbyStores.length}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildLocationRecognizedText)(msg.fromUserName, addressText, nearbyStores);
        }
        const draft = (_g = session === null || session === void 0 ? void 0 : session.draft) !== null && _g !== void 0 ? _g : {};
        if (state === 'awaiting_address') {
            const phone = draft.phone;
            if (!phone) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const indices = (_h = draft.indices) !== null && _h !== void 0 ? _h : [];
            const picked = ((_j = session === null || session === void 0 ? void 0 : session.results) !== null && _j !== void 0 ? _j : []).filter(r => indices.includes(r.index));
            const outcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, phone, addressText, geo);
            await this.sessionService.clearFlow(msg.fromUserName);
            switch (outcome.status) {
                case 'ok':
                    if (!picked.length)
                        return (0, card_builder_1.buildBindSuccessText)(msg.fromUserName);
                    return this.placeOrder(ctx, msg.fromUserName, outcome.customer, picked);
                case 'phone_taken':
                    return (0, card_builder_1.buildPhoneTakenText)(msg.fromUserName, this.loginUrl());
                default:
                    return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, outcome.message);
            }
        }
        if (state === 'addr_new_text') {
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const nextDraft = Object.assign(Object.assign({}, draft), { pendingText: addressText.slice(0, 250), geo, city: (_k = reverse.city) !== null && _k !== void 0 ? _k : null });
            const registeredPhone = (_l = customer.phoneNumber) !== null && _l !== void 0 ? _l : '';
            if (registeredPhone) {
                await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone', nextDraft, ttl);
                return (0, card_builder_1.buildAddrNewPhoneText)(msg.fromUserName, registeredPhone);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_phone_text', nextDraft, ttl);
            return (0, card_builder_1.buildAddrNewPhonePromptText)(msg.fromUserName);
        }
        if (state === 'addr_edit_text') {
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome)
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, addressText, {
                latitude: lat,
                longitude: lng,
                province: reverse.province,
                city: reverse.city,
            });
            if (!ok)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '修改地址失败');
            const updated = await this.addressBook.getItem(outcome.ctx, outcome.customerId, outcome.addressId);
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildAddrSavedText)(msg.fromUserName, updated);
        }
        return (0, card_builder_1.buildLocationFlowBusyText)(msg.fromUserName);
    }
    /** 地理编码城市提示：已有定位结果时用其城市提升文本地址命中率 */
    geoHint(draft) {
        var _a;
        return ((_a = draft.geo) === null || _a === void 0 ? void 0 : _a.city) ? { city: draft.geo.city } : undefined;
    }
    // ============ 城市识别 + 3km 门店匹配（熟店优先） ============
    /** 定位坐标 → 3km 内门店（熟店优先）；顾客未绑定/门店服务异常一律降级为空列表 */
    async matchStores(ctx, openid, lat, lng) {
        try {
            const customer = await this.customerBinding.findCustomerByOpenid(openid);
            const familiarStoreIds = await this.storeLocator.familiarStoreIds(ctx, customer === null || customer === void 0 ? void 0 : customer.id);
            return await this.storeLocator.findNearby(ctx, lat, lng, { familiarStoreIds });
        }
        catch (e) {
            core_1.Logger.warn(`Assistant store matching failed: ${String(e)}`, constants_1.loggerCtx);
            return [];
        }
    }
    /** 「附近门店」：用最近一次定位坐标匹配（无定位先引导发送位置） */
    async handleNearbyStores(msg) {
        var _a, _b, _c, _d, _e;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const draft = (_b = session === null || session === void 0 ? void 0 : session.draft) !== null && _b !== void 0 ? _b : {};
        const geo = draft.geo;
        if (!geo || !geo_service_1.GeoService.isValidCoordinate(geo.lat, geo.lng)) {
            return (0, card_builder_1.buildStoreNeedLocationText)(msg.fromUserName);
        }
        const channelId = (_c = session === null || session === void 0 ? void 0 : session.channelId) !== null && _c !== void 0 ? _c : (await this.resolveChannelId(msg.channelToken));
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const ctx = await this.createShopCtx(channelId);
        const city = (_e = (_d = draft.city) !== null && _d !== void 0 ? _d : geo.city) !== null && _e !== void 0 ? _e : null;
        const stores = await this.matchStores(ctx, msg.fromUserName, geo.lat, geo.lng);
        if (!stores.length) {
            return (0, card_builder_1.buildNoNearbyStoresText)(msg.fromUserName, city);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'store_pick', Object.assign(Object.assign({}, draft), { nearbyStores: stores }), ttl);
        core_1.Logger.info(`Assistant nearby stores listed: openid=${msg.fromUserName} count=${stores.length}`, constants_1.loggerCtx);
        return (0, card_builder_1.buildNearbyStoresText)(msg.fromUserName, stores, city);
    }
    /** store_pick：回复「门店N」/「N」选定门店（记入草稿，供后续下单就近安排） */
    async onStorePick(msg, text, draft, ttl) {
        var _a, _b;
        const stores = (_a = draft.nearbyStores) !== null && _a !== void 0 ? _a : [];
        const indices = (0, intent_1.parseOrderIndices)((0, intent_1.normalizeInput)(text).replace(/^门店/, ''));
        const index = (_b = indices === null || indices === void 0 ? void 0 : indices[0]) !== null && _b !== void 0 ? _b : 0;
        if (index < 1 || index > stores.length) {
            return (0, card_builder_1.buildStoreSelectionInvalidText)(msg.fromUserName, stores.length);
        }
        const store = stores[index - 1];
        await this.sessionService.setFlow(msg.fromUserName, null, Object.assign(Object.assign({}, draft), { storeId: store.id }), ttl);
        core_1.Logger.info(`Assistant store selected: openid=${msg.fromUserName} storeId=${store.id}`, constants_1.loggerCtx);
        return (0, card_builder_1.buildStoreSelectedText)(msg.fromUserName, store);
    }
    // ============ 一键客服（全局，任何状态生效，不打断原流程） ============
    /**
     * 客服卡片：先引导「在线留言」，不展示电话；同一会话第 3 次求助起附客服微信。
     * 多候选未选 → 「客服N」选择；同一门店 10 分钟内重复只回短提示。
     * 全程不改会话状态（用户下一次输入仍按原流程处理）。
     */
    async handleSupport(msg, storeIndex) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const session = await this.sessionService.getActive(msg.fromUserName);
        const draft = (_b = session === null || session === void 0 ? void 0 : session.draft) !== null && _b !== void 0 ? _b : {};
        const stores = (_c = draft.nearbyStores) !== null && _c !== void 0 ? _c : [];
        const channelId = (_d = session === null || session === void 0 ? void 0 : session.channelId) !== null && _d !== void 0 ? _d : (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        // 同一会话内「客服」求助次数：第 3 次起提供客服微信（引导发语音）
        const askCount = Number((_e = draft.supportAskCount) !== null && _e !== void 0 ? _e : 0) + 1;
        const wechatId = askCount >= card_builder_1.SUPPORT_WECHAT_AFTER ? card_builder_1.SUPPORT_WECHAT_ID : null;
        let contact = null;
        if (storeIndex != null) {
            const picked = stores[storeIndex - 1];
            if (!picked)
                return (0, card_builder_1.buildSupportInvalidStoreText)(msg.fromUserName, stores.length);
            contact = (_f = (await this.storeLocator.findContact(ctx, picked.id))) !== null && _f !== void 0 ? _f : this.contactFromNearby(picked);
        }
        else if (draft.storeId) {
            contact =
                (_g = (await this.storeLocator.findContact(ctx, draft.storeId))) !== null && _g !== void 0 ? _g : this.contactFromNearby(stores.find(store => store.id === draft.storeId));
        }
        else if (stores.length === 1) {
            contact = (_h = (await this.storeLocator.findContact(ctx, stores[0].id))) !== null && _h !== void 0 ? _h : this.contactFromNearby(stores[0]);
        }
        // 多个候选且未选门店：先让用户用「客服N」指定（不进入状态机）
        if (!contact && stores.length > 1) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            await this.sessionService.saveDraft(msg.fromUserName, Object.assign(Object.assign({}, draft), { supportAskCount: askCount }), ttl);
            return (0, card_builder_1.buildSupportStorePickText)(msg.fromUserName, stores, wechatId);
        }
        const now = Date.now();
        const sameTarget = String((_j = draft.supportStoreId) !== null && _j !== void 0 ? _j : '') === String((_k = contact === null || contact === void 0 ? void 0 : contact.id) !== null && _k !== void 0 ? _k : '');
        // 第 3 次起必须带微信号，不再走「重复只回短提示」
        if (!wechatId && now - Number((_l = draft.supportAt) !== null && _l !== void 0 ? _l : 0) < SUPPORT_REPEAT_WINDOW_MS && sameTarget) {
            await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
            await this.sessionService.saveDraft(msg.fromUserName, Object.assign(Object.assign({}, draft), { supportAskCount: askCount }), ttl);
            return (0, card_builder_1.buildSupportRepeatText)(msg.fromUserName, { name: (_m = contact === null || contact === void 0 ? void 0 : contact.name) !== null && _m !== void 0 ? _m : null });
        }
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        const picked = ((_o = session === null || session === void 0 ? void 0 : session.results) !== null && _o !== void 0 ? _o : []).filter(r => { var _a; return ((_a = draft.indices) !== null && _a !== void 0 ? _a : []).includes(r.index); });
        const items = picked.map(r => { var _a; return ({ title: r.title, quantity: (_a = r.quantity) !== null && _a !== void 0 ? _a : 1, price: r.price }); });
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        await this.sessionService.saveDraft(msg.fromUserName, Object.assign(Object.assign({}, draft), { supportAt: now, supportStoreId: (_p = contact === null || contact === void 0 ? void 0 : contact.id) !== null && _p !== void 0 ? _p : null, supportAskCount: askCount }), ttl);
        core_1.Logger.info(`Assistant support card: openid=${msg.fromUserName} store=${(_q = contact === null || contact === void 0 ? void 0 : contact.id) !== null && _q !== void 0 ? _q : 'none'} ask=${askCount} wechat=${Boolean(wechatId)}`, constants_1.loggerCtx);
        const cf = (_s = (_r = ctx.channel) === null || _r === void 0 ? void 0 : _r.customFields) !== null && _s !== void 0 ? _s : {};
        return (0, card_builder_1.buildSupportCard)(msg.fromUserName, {
            store: contact
                ? { name: contact.name, phoneNumber: contact.phoneNumber, businessHours: contact.businessHours }
                : null,
            items,
            total: items.length ? total : undefined,
            shopName: String((_t = cf.shopName) !== null && _t !== void 0 ? _t : '').trim() || null,
            shopUrl: this.shopUrlOf(cf),
            wechatId,
        });
    }
    /** 渠道店铺域名 → 绝对地址（兼容只存 `host/path` 的配置） */
    shopUrlOf(cf) {
        var _a;
        const raw = String((_a = cf === null || cf === void 0 ? void 0 : cf.domain) !== null && _a !== void 0 ? _a : '').trim();
        if (!raw)
            return null;
        return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
    }
    /**
     * 店铺名/简称识别：查询词等于店铺名（或去掉「店/超市」等后缀的主体）时回店铺信息。
     * 品类通用词（米/面/油/粮油…）不当作店名，避免挡住正常商品检索。
     */
    matchShopQuery(query, cf) {
        var _a;
        const name = String((_a = cf === null || cf === void 0 ? void 0 : cf.shopName) !== null && _a !== void 0 ? _a : '').trim();
        if (!name)
            return null;
        const q = (0, intent_1.normalizeInput)(query);
        if (q.length < 2)
            return null;
        const categoryWords = ['米', '面', '油', '粉', '粮油', '大米', '面粉', '食用油', '杂粮', '食品', '五谷'];
        if (categoryWords.includes(q))
            return null;
        const core = name.replace(/(粮油店|食品店|旗舰店|便利店|超市|商店|商行|店铺|店)$/u, '');
        if (!(q === name || q === core || (core.length >= 2 && core.includes(q))))
            return null;
        return {
            name,
            intro: (cf === null || cf === void 0 ? void 0 : cf.shopIntro) ? String(cf.shopIntro) : null,
            url: this.shopUrlOf(cf),
        };
    }
    /** 3km 门店列表项 → 客服联系方式（门店数据回查失败时兜底用） */
    contactFromNearby(store) {
        var _a, _b;
        if (!store)
            return null;
        return {
            id: store.id,
            name: store.name,
            address: store.address,
            phoneNumber: (_a = store.phoneNumber) !== null && _a !== void 0 ? _a : null,
            businessHours: (_b = store.businessHours) !== null && _b !== void 0 ? _b : null,
        };
    }
    // ============ 留言工单（≤200 字落库，后台回复经公众号下发） ============
    /** 「留言」入口：进入留言输入态，并记住当前流程状态（保存/取消后恢复） */
    async handleSupportNoteStart(msg, session) {
        var _a, _b, _c, _d, _e;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const channelId = (_b = session === null || session === void 0 ? void 0 : session.channelId) !== null && _b !== void 0 ? _b : (await this.resolveChannelId(msg.channelToken));
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        await this.sessionService.setFlow(msg.fromUserName, 'support_note', Object.assign(Object.assign({}, ((_c = session === null || session === void 0 ? void 0 : session.draft) !== null && _c !== void 0 ? _c : {})), { supportReturnState: (_d = session === null || session === void 0 ? void 0 : session.state) !== null && _d !== void 0 ? _d : null }), ttl);
        core_1.Logger.info(`Assistant support note started: openid=${msg.fromUserName} returnState=${(_e = session === null || session === void 0 ? void 0 : session.state) !== null && _e !== void 0 ? _e : 'none'}`, constants_1.loggerCtx);
        return (0, card_builder_1.buildSupportNotePromptText)(msg.fromUserName);
    }
    /** 留言正文：校验长度 → 落库工单 → 恢复原流程状态 */
    async onSupportNote(msg, session) {
        var _a, _b, _c, _d, _e, _f, _g;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const text = (msg.content || '').trim();
        const draft = (_b = session.draft) !== null && _b !== void 0 ? _b : {};
        // 取消：放弃留言并恢复留言前的流程状态
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.setFlow(msg.fromUserName, (_c = draft.supportReturnState) !== null && _c !== void 0 ? _c : null, Object.assign(Object.assign({}, draft), { supportReturnState: null }), ttl);
            return (0, card_builder_1.buildSupportNoteCancelledText)(msg.fromUserName);
        }
        if (text.length > 200) {
            return (0, card_builder_1.buildSupportNoteTooLongText)(msg.fromUserName, text.length);
        }
        const channelId = (_d = session.channelId) !== null && _d !== void 0 ? _d : (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        const store = await this.resolveSupportStore(ctx, draft);
        let ticketId;
        try {
            const ticket = await this.supportTickets.create(ctx, {
                openid: msg.fromUserName,
                channelId: Number(channelId),
                customerId: customer ? Number(customer.id) : null,
                storeId: (_e = store === null || store === void 0 ? void 0 : store.id) !== null && _e !== void 0 ? _e : null,
                storeName: (_f = store === null || store === void 0 ? void 0 : store.name) !== null && _f !== void 0 ? _f : null,
                summary: this.supportSummary(session, draft),
                content: text,
            });
            ticketId = String(ticket.id);
            core_1.Logger.info(`Assistant support note saved: openid=${msg.fromUserName} ticket=${ticketId}`, constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.error(`Assistant support note save failed: ${String(e)}`, constants_1.loggerCtx);
            // 落库失败保留输入态，用户可重发或取消
            return {
                kind: 'text',
                touser: msg.fromUserName,
                content: '留言提交失败，请稍后重试一次；也可回复「客服」直接电话联系。',
            };
        }
        await this.sessionService.setFlow(msg.fromUserName, (_g = draft.supportReturnState) !== null && _g !== void 0 ? _g : null, Object.assign(Object.assign({}, draft), { supportReturnState: null }), ttl);
        return (0, card_builder_1.buildSupportNoteSavedText)(msg.fromUserName, ticketId);
    }
    /** 留言关联门店：最近客服门店 → 已选门店 → 3km 唯一候选 */
    async resolveSupportStore(ctx, draft) {
        var _a, _b, _c, _d, _e, _f;
        const single = ((_a = draft.nearbyStores) === null || _a === void 0 ? void 0 : _a.length) === 1 ? draft.nearbyStores[0] : null;
        const storeId = (_d = (_c = (_b = draft.supportStoreId) !== null && _b !== void 0 ? _b : draft.storeId) !== null && _c !== void 0 ? _c : single === null || single === void 0 ? void 0 : single.id) !== null && _d !== void 0 ? _d : null;
        if (!storeId)
            return null;
        const cached = (_e = draft.nearbyStores) === null || _e === void 0 ? void 0 : _e.find(store => store.id === storeId);
        if (cached === null || cached === void 0 ? void 0 : cached.name)
            return { id: storeId, name: cached.name };
        try {
            const contact = await this.storeLocator.findContact(ctx, storeId);
            return { id: storeId, name: (_f = contact === null || contact === void 0 ? void 0 : contact.name) !== null && _f !== void 0 ? _f : null };
        }
        catch (_g) {
            return { id: storeId, name: null };
        }
    }
    /** 工单上下文摘要：当前这单商品/合计 + 城市（便于客服定位问题） */
    supportSummary(session, draft) {
        var _a;
        const parts = [];
        const picked = ((_a = session.results) !== null && _a !== void 0 ? _a : []).filter(r => { var _a; return ((_a = draft.indices) !== null && _a !== void 0 ? _a : []).includes(r.index); });
        if (picked.length) {
            const items = picked.map(r => { var _a; return `${r.title} ×${(_a = r.quantity) !== null && _a !== void 0 ? _a : 1}`; }).join('，');
            const total = picked.reduce((sum, r) => { var _a; return sum + r.price * ((_a = r.quantity) !== null && _a !== void 0 ? _a : 1); }, 0);
            parts.push(`商品：${items}，合计 ${(0, card_builder_1.formatPrice)(total)}`);
        }
        if (draft.city)
            parts.push(`城市：${draft.city}`);
        return parts.length ? parts.join('；').slice(0, 500) : null;
    }
    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导；并按渠道配置选支付方式 */
    async orderConfirmCard(ctx, touser, session, draft) {
        var _a, _b, _c;
        const picked = session.results.filter(r => { var _a; return ((_a = draft.indices) !== null && _a !== void 0 ? _a : []).includes(r.index); });
        if (!picked.length)
            return (0, card_builder_1.buildSessionExpiredText)(touser);
        const customer = await this.customerBinding.findCustomerByOpenid(touser);
        if (!customer)
            return (0, card_builder_1.buildBindGuideText)(touser, this.loginUrl());
        const items = await this.addressBook.list(ctx, customer.id);
        const address = (_b = (_a = (draft.pickAddressId ? items.find(a => a.id === draft.pickAddressId) : null)) !== null && _a !== void 0 ? _a : items.find(a => a.isDefault)) !== null && _b !== void 0 ? _b : items[0];
        if (!address)
            return (0, card_builder_1.buildAddressListCard)(touser, [], 'order');
        // 配送守卫/切店/起送价前移到确认卡之前：不通过则不展示确认卡
        const blocked = await this.preflightOrder(ctx, touser, session, picked, address);
        if (blocked)
            return blocked;
        // 支付方式完全由渠道配置驱动：0 个不建单；1 个自动选中；≥2 个先让用户选
        const ttl = (_c = this.opts.sessionTtlMinutes) !== null && _c !== void 0 ? _c : 30;
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            await this.sessionService.clearFlow(touser);
            core_1.Logger.info(`Assistant no payment method: channel=${session.channelId}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildNoPaymentMethodText)(touser);
        }
        const current = methods.find(m => m.code === draft.paymentMethodCode);
        if (!current && methods.length > 1) {
            await this.sessionService.setFlow(touser, 'pay_pick', Object.assign(Object.assign({}, draft), { paymentMethodCode: null, paymentMethods: methods }), ttl);
            return (0, card_builder_1.buildPaymentPickText)(touser, methods);
        }
        const selected = current !== null && current !== void 0 ? current : methods[0];
        return (0, card_builder_1.buildOrderConfirmCard)(touser, {
            items: picked.map(p => { var _a; return ({ title: p.title, quantity: (_a = p.quantity) !== null && _a !== void 0 ? _a : 1, price: p.price }); }),
            total: picked.reduce((s, p) => { var _a; return s + p.price * ((_a = p.quantity) !== null && _a !== void 0 ? _a : 1); }, 0),
            address,
            payment: { name: selected.name, canSwitch: methods.length > 1 },
            etaMinutes: await this.channelDeliveryMinutes(session.channelId),
        });
    }
    /** pay_pick：回复编号选支付方式 → 回下单确认；0 返回地址列表 */
    async onPayPick(msg, session, text, draft, ttl) {
        const ctx = await this.createShopCtx(session.channelId);
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return (0, card_builder_1.buildNoPaymentMethodText)(msg.fromUserName);
        }
        const input = (0, intent_1.normalizeInput)(text);
        if (input === '0') {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', Object.assign(Object.assign({}, draft), { pickIndex: null, pickAddressId: null }), ttl);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const items = await this.addressBook.list(ctx, customer.id);
            return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, items, 'order');
        }
        const n = /^\d{1,2}$/.test(input) ? Number(input) : 0;
        if (n < 1 || n > methods.length) {
            return (0, card_builder_1.buildPaymentPickText)(msg.fromUserName, methods);
        }
        const selected = methods[n - 1];
        const nextDraft = Object.assign(Object.assign({}, draft), { paymentMethodCode: selected.code, paymentMethods: methods });
        await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', nextDraft, ttl);
        core_1.Logger.info(`Assistant payment method selected: ${selected.code} openid=${msg.fromUserName}`, constants_1.loggerCtx);
        return this.orderConfirmCard(ctx, msg.fromUserName, session, nextDraft);
    }
    /** 「支付方式」查询：按当前渠道配置列出（不改变会话状态） */
    async handlePaymentMethodsInfo(msg, session) {
        var _a;
        const channelId = (_a = session === null || session === void 0 ? void 0 : session.channelId) !== null && _a !== void 0 ? _a : (await this.resolveChannelId(msg.channelToken));
        const ctx = await this.createShopCtx(channelId);
        const methods = await this.orderService.listPaymentMethods(ctx);
        return methods.length
            ? (0, card_builder_1.buildPaymentMethodsInfoText)(msg.fromUserName, methods)
            : (0, card_builder_1.buildNoPaymentMethodText)(msg.fromUserName);
    }
    // ============ 搜索：meili 检索 → 会话保存 → 卡片消息 ============
    async handleSearch(msg, query, quantity) {
        var _a, _b, _c, _d, _e, _f;
        const channelId = await this.resolveChannelId(msg.channelToken);
        // 店铺名/简称（如「利民」）优先回店铺信息，避免正文里带店铺名导致全店泛匹配
        const ctx = await this.createShopCtx(channelId);
        const shop = this.matchShopQuery(query, (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {});
        if (shop) {
            core_1.Logger.info(`Assistant shop info: openid=${msg.fromUserName} query=${query}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildShopInfoCard)(msg.fromUserName, shop);
        }
        let products;
        try {
            products = await this.searchService.searchProducts({
                query,
                channelId,
                locale: (_c = this.opts.searchLocale) !== null && _c !== void 0 ? _c : 'zh',
                limit: (_d = this.opts.searchLimit) !== null && _d !== void 0 ? _d : 5,
                storefrontUrl: this.storefront(),
                productUrlTemplate: this.opts.productUrlTemplate,
            });
        }
        catch (e) {
            core_1.Logger.error(`Assistant search failed: ${String(e)}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildSearchErrorText)(msg.fromUserName);
        }
        if (!products.length) {
            return (0, card_builder_1.buildNoResultText)(msg.fromUserName, query);
        }
        // 数量进会话：编号下单时按该数量加购
        const results = products.map(p => (Object.assign(Object.assign({}, p), { quantity })));
        await this.sessionService.saveResults(msg.fromUserName, channelId, results, query, (_e = this.opts.sessionTtlMinutes) !== null && _e !== void 0 ? _e : 30);
        return (_f = (0, card_builder_1.buildNewsMessage)(msg.fromUserName, results)) !== null && _f !== void 0 ? _f : (0, card_builder_1.buildTextListMessage)(msg.fromUserName, results);
    }
    // ============ 下单：编号回查会话 → 绑定校验/建档 → 建单 → 确认通知 ============
    async handleOrder(msg, indices, boundPhone) {
        var _a, _b;
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (!session) {
            return (0, card_builder_1.buildSessionExpiredText)(msg.fromUserName);
        }
        const picked = session.results.filter(r => indices.includes(r.index));
        if (!picked.length) {
            return (0, card_builder_1.buildInvalidOrderText)(msg.fromUserName, indices);
        }
        // 身份门槛：openid → Customer；未绑定时按可用信息走自动/补录建档
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
            // 路径 A：sso 已绑定用户带手机号 → 自动建档后直接续下单（零输入）
            if (boundPhone) {
                const ctx = await this.createShopCtx(session.channelId);
                const bindOutcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, boundPhone);
                if (bindOutcome.status === 'ok') {
                    core_1.Logger.info(`Assistant path-A auto bind: customerId=${bindOutcome.customer.id} openid=${msg.fromUserName}`, constants_1.loggerCtx);
                    return this.placeOrder(ctx, msg.fromUserName, bindOutcome.customer, picked);
                }
                if (bindOutcome.status === 'error') {
                    core_1.Logger.warn(`Assistant path-A auto bind failed (${bindOutcome.message}), fallback to flow`, constants_1.loggerCtx);
                }
                // phone_taken / error → 回退路径 B（聊天内补录另一手机号）
            }
            // 路径 B：进入聊天内补录状态机（手机号 → 收货地址 → 建档续下单）
            await this.sessionService.setFlow(msg.fromUserName, 'awaiting_phone', { indices }, ttl);
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        }
        // 已绑定：默认地址直接用（守卫/起送价在确认卡前校验），否则出地址列表选址
        const ctx = await this.createShopCtx(session.channelId);
        const ttl = (_b = this.opts.sessionTtlMinutes) !== null && _b !== void 0 ? _b : 30;
        const addressItems = await this.addressBook.list(ctx, customer.id);
        if (!addressItems.length) {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', { indices, flow: 'order' }, ttl);
            return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, [], 'order');
        }
        const defaultAddr = addressItems.find(a => a.isDefault);
        if (defaultAddr) {
            const draft = {
                indices,
                flow: 'order',
                pickIndex: defaultAddr.index,
                pickAddressId: defaultAddr.id,
            };
            await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', draft, ttl);
            return this.orderConfirmCard(ctx, msg.fromUserName, session, draft);
        }
        await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { indices, flow: 'order' }, ttl);
        return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, addressItems, 'order');
    }
    /**
     * 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示）。
     * addressId：对话选址的地址；未传时回退顾客默认地址（建档续下单场景——
     * 路径 A/B 刚建档的首地址即默认，直接落单保持零输入）。
     * 选定地址含收货人/电话，随 setShippingAddress 写入订单。
     */
    async placeOrder(ctx, touser, customer, picked, addressId, payment) {
        var _a, _b;
        // 渠道未配置可用支付方式 → 不建单（后台关闭后下一次会话立即生效）
        const methods = await this.orderService.listPaymentMethods(ctx);
        if (!methods.length) {
            core_1.Logger.info(`Assistant order blocked: no payment method channel=${ctx.channelId}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildNoPaymentMethodText)(touser);
        }
        const selected = payment && methods.some(m => m.code === payment.code) ? payment : methods[0];
        const addressItems = await this.addressBook.list(ctx, customer.id);
        const addrItem = (_b = (_a = (addressId ? addressItems.find(a => a.id === addressId) : null)) !== null && _a !== void 0 ? _a : addressItems.find(a => a.isDefault)) !== null && _b !== void 0 ? _b : undefined;
        const address = addrItem
            ? { fullName: addrItem.fullName, phoneNumber: addrItem.phoneNumber, streetLine1: addrItem.streetLine1 }
            : undefined;
        if (addrItem) {
            core_1.Logger.info(`Assistant order shipping address: addressId=${addrItem.id}`, constants_1.loggerCtx);
        }
        // 下单前二次兜底：租户路由 / 配送守卫 / 起送价（确认卡前已校验一次，防止后台配置变化）
        const session = await this.sessionService.getActive(touser);
        const blocked = await this.preflightOrder(ctx, touser, session, picked, addrItem);
        if (blocked)
            return blocked;
        const outcome = await this.orderService.createOrder(ctx, customer, picked.map(p => { var _a; return ({ productId: p.productId, quantity: (_a = p.quantity) !== null && _a !== void 0 ? _a : 1 }); }), address);
        switch (outcome.status) {
            case 'ok': {
                // 货到付款/门店收银（cash-on-delivery）无需支付链接
                const payUrl = selected.handlerCode === 'cash-on-delivery'
                    ? undefined
                    : this.payUrl(outcome.order.code);
                core_1.Logger.info(`Assistant order created: ${outcome.order.code}`, constants_1.loggerCtx);
                return (0, card_builder_1.buildOrderSuccessText)(touser, {
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
                return (0, card_builder_1.buildOutOfStockText)(touser, outcome.title);
            default:
                return (0, card_builder_1.buildOrderFailText)(touser, outcome.message);
        }
    }
    // ============ 基础设施 ============
    /** 渠道展示名：装修 shopName → channel.code */
    async channelName(channelId) {
        var _a, _b;
        const ch = await this.connection.getRepository(core_1.Channel).findOne({ where: { id: channelId } });
        const cf = ((_a = ch === null || ch === void 0 ? void 0 : ch.customFields) !== null && _a !== void 0 ? _a : {});
        return cf.shopName ? String(cf.shopName) : (_b = ch === null || ch === void 0 ? void 0 : ch.code) !== null && _b !== void 0 ? _b : null;
    }
    /** 渠道预计送达分钟数（未配置返回 null → 文案提示电话确认） */
    async channelDeliveryMinutes(channelId) {
        var _a;
        const ch = await this.connection.getRepository(core_1.Channel).findOne({ where: { id: channelId } });
        const cf = ((_a = ch === null || ch === void 0 ? void 0 : ch.customFields) !== null && _a !== void 0 ? _a : {});
        return cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null;
    }
    /** 渠道起送价（分）；未配置按 0 处理 */
    async channelMinOrderAmount(channelId) {
        var _a;
        const ch = await this.connection.getRepository(core_1.Channel).findOne({ where: { id: channelId } });
        const cf = ((_a = ch === null || ch === void 0 ? void 0 : ch.customFields) !== null && _a !== void 0 ? _a : {});
        return cf.minOrderAmount != null ? Math.max(Number(cf.minOrderAmount), 0) : 0;
    }
    /**
     * 下单前预检（确认卡与建单共用）：
     * 地址解析 → 租户路由（必要时切店并重搜）→ 配送范围守卫 → 起送价。
     * 返回 null 表示通过；否则为应直接回复给用户的消息。
     */
    async preflightOrder(ctx, touser, session, picked, address) {
        var _a, _b, _c, _d, _e;
        const routingOn = process.env.ASSISTANT_CITY_ROUTING !== 'off';
        if (routingOn && (address === null || address === void 0 ? void 0 : address.streetLine1)) {
            const parsed = await this.deliveryGuard.parse(ctx, address.streetLine1, 
            // 地址簿已存坐标：地理编码超时/失败时用它兜底判定城市
            address.latitude != null && address.longitude != null
                ? { lat: Number(address.latitude), lng: Number(address.longitude) }
                : null);
            if (!parsed) {
                return (0, card_builder_1.buildOrderFailText)(touser, '配送校验暂时不可用，请稍后再试');
            }
            const route = await this.tenantRouter.resolve(ctx, {
                cityCode: parsed.cityCode,
                currentChannelId: String(ctx.channelId),
                lat: parsed.lat,
                lng: parsed.lng,
            });
            // 排序第一的渠道不是当前渠道 → 切店（当前渠道即使也在候选内，精度/优先级更低时也要让位）
            const target = route.chosen && route.chosen.channelId !== String(ctx.channelId) ? route.chosen : null;
            if (target) {
                if (!session) {
                    return (0, card_builder_1.buildOrderFailText)(touser, '会话已过期，请重新发送商品名');
                }
                // 切店：用原关键词在新渠道重搜，结果写回会话（channelId 一并切换），让用户重新回编号
                const query = (_b = (_a = session.query) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
                const ttl = (_c = this.opts.sessionTtlMinutes) !== null && _c !== void 0 ? _c : 30;
                await this.sessionService.saveDraft(touser, { cityCode: parsed.cityCode, resolvedChannelId: target.channelId, pendingQuery: query || null }, ttl);
                let hits = [];
                if (query) {
                    try {
                        hits = await this.searchService.searchProducts({
                            query,
                            channelId: target.channelId,
                            locale: (_d = this.opts.searchLocale) !== null && _d !== void 0 ? _d : 'zh',
                            limit: (_e = this.opts.searchLimit) !== null && _e !== void 0 ? _e : 5,
                            storefrontUrl: this.storefront(),
                            productUrlTemplate: this.opts.productUrlTemplate,
                        });
                    }
                    catch (e) {
                        core_1.Logger.warn(`Assistant switch-channel search failed: ${String(e)}`, constants_1.loggerCtx);
                    }
                }
                // 无论新店是否有货都切会话渠道并覆盖结果：否则旧店编号仍可下单，会在守卫处反复切店
                await this.sessionService.saveResults(touser, target.channelId, hits.map(h => { var _a, _b; return (Object.assign(Object.assign({}, h), { quantity: (_b = (_a = picked[0]) === null || _a === void 0 ? void 0 : _a.quantity) !== null && _b !== void 0 ? _b : 1 })); }), query, ttl);
                await this.sessionService.clearFlow(touser);
                core_1.Logger.info(`Assistant channel switched: ${ctx.channelId} → ${target.channelId} city=${parsed.cityCode} hits=${hits.length}`, constants_1.loggerCtx);
                return query && !hits.length
                    ? (0, card_builder_1.buildChannelSwitchNoMatchText)(touser, target.channelName, query)
                    : (0, card_builder_1.buildChannelSwitchText)(touser, target.channelName);
            }
            const guard = await this.deliveryGuard.checkParsed(ctx, String(ctx.channelId), parsed);
            if (guard.status === 'UNKNOWN') {
                return (0, card_builder_1.buildOrderFailText)(touser, '配送校验暂时不可用，请稍后再试');
            }
            if (guard.status === 'OUT_OF_RANGE') {
                return (0, card_builder_1.buildOutOfRangeText)(touser, {
                    address: address.streetLine1,
                    serviceAreaText: guard.serviceAreaText,
                    channelName: await this.channelName(String(ctx.channelId)),
                });
            }
        }
        const total = picked.reduce((sum, p) => { var _a, _b; return sum + ((_a = p.price) !== null && _a !== void 0 ? _a : 0) * ((_b = p.quantity) !== null && _b !== void 0 ? _b : 1); }, 0);
        const minAmount = await this.channelMinOrderAmount(String(ctx.channelId));
        if (minAmount > 0 && total < minAmount) {
            await this.sessionService.clearFlow(touser);
            core_1.Logger.info(`Assistant order blocked by minOrderAmount: channel=${ctx.channelId} total=${total} min=${minAmount}`, constants_1.loggerCtx);
            return (0, card_builder_1.buildMinOrderAmountText)(touser, { total, minAmount });
        }
        return null;
    }
    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    async claimInboundDedup(msg) {
        const dedupKey = (0, intent_1.buildDedupKey)(msg);
        try {
            await this.connection.getRepository(wechat_processed_message_entity_1.WechatProcessedMessage).insert({
                dedupKey,
                receivedAt: new Date(),
            });
            return true;
        }
        catch (_a) {
            core_1.Logger.info(`Duplicated wechat message skipped: ${dedupKey}`, constants_1.loggerCtx);
            return false;
        }
    }
    async resolveChannelId(channelToken) {
        if (channelToken) {
            try {
                const channel = await this.channelService.findOne(core_1.RequestContext.empty(), channelToken);
                if (channel)
                    return String(channel.id);
            }
            catch (_a) {
                // fallthrough
            }
            // findOne 只按 id 查；再按 token 精确匹配（sso 转调经 env 配置传入渠道 token）
            try {
                const { items } = await this.channelService.findAll(core_1.RequestContext.empty());
                const byToken = items.find(c => c.token === channelToken);
                if (byToken)
                    return String(byToken.id);
            }
            catch (_b) {
                // fallthrough
            }
        }
        return '1';
    }
    /** 地址流程目标渠道：优先复用既有会话的渠道（用户在该渠道搜的品），无会话按消息渠道 token */
    async resolveSessionChannelId(msg) {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (session === null || session === void 0 ? void 0 : session.channelId)
            return session.channelId;
        return this.resolveChannelId(msg.channelToken);
    }
    /**
     * 按会话存的渠道 ID 建 shop 上下文：
     * RequestContextService.create 的 channelOrToken 仅认 Channel 实体或 token 字符串，
     * 会话存的是渠道 ID，须先换实体；查不到时传 undefined 落默认渠道（与 resolveChannelId 兜底一致）。
     */
    async createShopCtx(channelId) {
        var _a;
        const channel = channelId
            ? ((_a = (await this.connection.getRepository(core_1.Channel).findOne({
                where: { id: channelId },
                relations: { defaultTaxZone: true, defaultShippingZone: true },
            }))) !== null && _a !== void 0 ? _a : undefined)
            : undefined;
        return this.requestContextService.create({ apiType: 'shop', channelOrToken: channel });
    }
    storefront() {
        var _a;
        return ((_a = this.opts.storefrontUrl) !== null && _a !== void 0 ? _a : '').replace(/\/+$/, '');
    }
    loginUrl() {
        if (this.opts.loginUrlTemplate)
            return this.opts.loginUrlTemplate;
        return this.storefront() ? `${this.storefront()}/account/login` : undefined;
    }
    /** 支付确认页：优先模板（hash 路由前端，如 `https://host/#/pkg-order/pages/payment?code={code}`） */
    payUrl(orderCode) {
        if (this.opts.payUrlTemplate)
            return this.opts.payUrlTemplate.replace('{code}', encodeURIComponent(orderCode));
        return this.storefront() ? `${this.storefront()}/checkout/confirmation/${orderCode}` : undefined;
    }
};
exports.AssistantService = AssistantService;
exports.AssistantService = AssistantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.WECHAT_ASSISTANT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        session_service_1.SessionService,
        search_adapter_1.AssistantSearchService,
        order_service_1.AssistantOrderService,
        wechat_sender_1.WechatSender,
        credential_service_1.CredentialService,
        core_1.ChannelService,
        core_1.RequestContextService,
        customer_binding_service_1.CustomerBindingService,
        address_service_1.AddressBookService,
        geo_service_1.GeoService,
        store_locator_service_1.StoreLocatorService,
        support_ticket_service_1.SupportTicketService,
        delivery_guard_service_1.DeliveryGuardService,
        tenant_router_service_1.TenantRouterService])
], AssistantService);
/** 微信位置坐标 + 逆地理行政区 → 可写入草稿/地址的坐标对象 */
function geoPointFromReverse(reverse, lat, lng) {
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
//# sourceMappingURL=assistant.service.js.map