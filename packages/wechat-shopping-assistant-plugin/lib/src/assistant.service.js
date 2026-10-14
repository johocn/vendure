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
const constants_1 = require("./constants");
const credential_service_1 = require("./credential.service");
const customer_binding_service_1 = require("./customer-binding.service");
const wechat_processed_message_entity_1 = require("./entities/wechat-processed-message.entity");
const intent_1 = require("./intent");
const order_service_1 = require("./order.service");
const search_adapter_1 = require("./search-adapter");
const session_service_1 = require("./session.service");
const wechat_sender_1 = require("./wechat-sender");
/**
 * 微信购物助手编排器：
 * 回调事件（WechatMessageEvent）→ 去重 → 意图识别 → 搜索/下单 → 客服消息回复。
 * 全链路异步执行且吞掉异常（回调 5 秒内已回 success，超时微信会重试，
 * 重复推送由 MsgId 去重表挡住）。
 */
let AssistantService = class AssistantService {
    constructor(opts, connection, sessionService, searchService, orderService, sender, credentialService, channelService, requestContextService, customerBinding, addressBook) {
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
        if (!(await this.claimDedup(msg)))
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
        var _a, _b;
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? (0, card_builder_1.buildWelcomeText)(msg.fromUserName) : null;
        }
        if (msg.msgType !== 'text' || !msg.content)
            return null;
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        // 补录状态机优先：处于手机号/地址补录中的用户，输入不走意图识别
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (session === null || session === void 0 ? void 0 : session.state) {
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
                return this.handleSearch(msg, intent.query, (_b = intent.quantity) !== null && _b !== void 0 ? _b : 1);
            case 'order':
                return this.handleOrder(msg, intent.indices, extra === null || extra === void 0 ? void 0 : extra.boundPhone);
            case 'address_manage':
                return this.handleAddressManage(msg);
            case 'address_add':
                return this.handleAddressAdd(msg);
        }
        return null;
    }
    // ============ 状态机：补录（awaiting_*）+ 地址簿/选址（addr_* / order_confirm） ============
    async handleFlowStep(msg, session) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const text = (msg.content || '').trim();
        if (/^(取消|退出)[!！。.~]?$/.test(text)) {
            await this.sessionService.clearFlow(msg.fromUserName);
            return (0, card_builder_1.buildFlowCancelledText)(msg.fromUserName);
        }
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const draft = (_b = session.draft) !== null && _b !== void 0 ? _b : {};
        if (session.state === 'awaiting_phone') {
            const phone = text.replace(/[-\s]/g, '');
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return (0, card_builder_1.buildInvalidPhoneText)(msg.fromUserName);
            }
            await this.sessionService.setFlow(msg.fromUserName, 'awaiting_address', { phone, indices: (_c = draft.indices) !== null && _c !== void 0 ? _c : [] }, ttl);
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
            const indices = (_d = draft.indices) !== null && _d !== void 0 ? _d : [];
            const picked = session.results.filter(r => indices.includes(r.index));
            const ctx = await this.createShopCtx(session.channelId);
            const outcome = await this.customerBinding.bindOrCreateCustomer(ctx, msg.fromUserName, phone, text);
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
            return (0, card_builder_1.buildAddrEditFieldText)(msg.fromUserName, (_e = draft.pickIndex) !== null && _e !== void 0 ? _e : 0);
        }
        if (session.state === 'addr_edit_text') {
            if (text.length < 8) {
                return (0, card_builder_1.buildInvalidAddressText)(msg.fromUserName);
            }
            const outcome = await this.withAddrCtx(msg, draft);
            if (!outcome)
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            const ok = await this.addressBook.updateText(outcome.ctx, outcome.addressId, text);
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
                const newDefault = item.isDefault ? ((_f = remaining.find(a => a.isDefault)) !== null && _f !== void 0 ? _f : null) : undefined;
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
            const registeredPhone = (_g = customer.phoneNumber) !== null && _g !== void 0 ? _g : '';
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
            const registeredPhone = (_h = customer === null || customer === void 0 ? void 0 : customer.phoneNumber) !== null && _h !== void 0 ? _h : '';
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
                return (0, card_builder_1.buildAddrNewDefaultText)(msg.fromUserName, (_j = draft.pendingText) !== null && _j !== void 0 ? _j : '', (_k = draft.pendingPhone) !== null && _k !== void 0 ? _k : '');
            }
            const ctx = await this.createShopCtx(session.channelId);
            const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
            if (!customer) {
                await this.sessionService.clearFlow(msg.fromUserName);
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            }
            const addressId = await this.addressBook.add(ctx, customer.id, {
                streetLine1: (_l = draft.pendingText) !== null && _l !== void 0 ? _l : '',
                phoneNumber: (_m = draft.pendingPhone) !== null && _m !== void 0 ? _m : '',
                setDefault: input === '是',
            });
            if (!addressId)
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, '保存地址失败');
            const item = await this.addressBook.getItem(ctx, customer.id, addressId);
            core_1.Logger.info(`Assistant address added: addressId=${addressId} flow=${(_o = draft.flow) !== null && _o !== void 0 ? _o : 'manage'}`, constants_1.loggerCtx);
            // 下单流程：新地址直接进下单确认；管理流程：落库后回列表态
            if (draft.flow === 'order') {
                await this.sessionService.setFlow(msg.fromUserName, 'order_confirm', Object.assign(Object.assign({}, draft), { pickAddressId: addressId }), ttl);
                return this.orderConfirmCard(ctx, msg.fromUserName, session, Object.assign(Object.assign({}, draft), { pickAddressId: addressId }));
            }
            await this.sessionService.setFlow(msg.fromUserName, 'addr_pick', { flow: 'manage' }, ttl);
            return (0, card_builder_1.buildAddrSavedText)(msg.fromUserName, item);
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
            if (input !== '1') {
                return this.orderConfirmCard(ctx, msg.fromUserName, session, draft);
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
            const out = await this.placeOrder(ctx, msg.fromUserName, customer, picked, (_p = draft.pickAddressId) !== null && _p !== void 0 ? _p : undefined);
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
    /** 「新增地址」入口：直接进新增地址文本状态（manage 流程） */
    async handleAddressAdd(msg) {
        var _a;
        const customer = await this.customerBinding.findCustomerByOpenid(msg.fromUserName);
        if (!customer)
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        const ttl = (_a = this.opts.sessionTtlMinutes) !== null && _a !== void 0 ? _a : 30;
        const channelId = await this.resolveSessionChannelId(msg);
        await this.sessionService.ensureSession(msg.fromUserName, channelId, ttl);
        await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', { flow: 'manage' }, ttl);
        return (0, card_builder_1.buildAddrEditTextPrompt)(msg.fromUserName);
    }
    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导 */
    async orderConfirmCard(ctx, touser, session, draft) {
        var _a, _b;
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
        return (0, card_builder_1.buildOrderConfirmCard)(touser, {
            items: picked.map(p => { var _a; return ({ title: p.title, quantity: (_a = p.quantity) !== null && _a !== void 0 ? _a : 1, price: p.price }); }),
            total: picked.reduce((s, p) => { var _a; return s + p.price * ((_a = p.quantity) !== null && _a !== void 0 ? _a : 1); }, 0),
            address,
        });
    }
    // ============ 搜索：meili 检索 → 会话保存 → 卡片消息 ============
    async handleSearch(msg, query, quantity) {
        var _a, _b, _c, _d;
        const channelId = await this.resolveChannelId(msg.channelToken);
        let products;
        try {
            products = await this.searchService.searchProducts({
                query,
                channelId,
                locale: (_a = this.opts.searchLocale) !== null && _a !== void 0 ? _a : 'zh',
                limit: (_b = this.opts.searchLimit) !== null && _b !== void 0 ? _b : 5,
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
        await this.sessionService.saveResults(msg.fromUserName, channelId, results, query, (_c = this.opts.sessionTtlMinutes) !== null && _c !== void 0 ? _c : 30);
        return (_d = (0, card_builder_1.buildNewsMessage)(msg.fromUserName, results)) !== null && _d !== void 0 ? _d : (0, card_builder_1.buildTextListMessage)(msg.fromUserName, results);
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
        // 已绑定：出地址列表选址（⭐默认置顶），无地址直接进新增
        const ctx = await this.createShopCtx(session.channelId);
        const ttl = (_b = this.opts.sessionTtlMinutes) !== null && _b !== void 0 ? _b : 30;
        const addressItems = await this.addressBook.list(ctx, customer.id);
        if (!addressItems.length) {
            await this.sessionService.setFlow(msg.fromUserName, 'addr_new_text', { indices, flow: 'order' }, ttl);
            return (0, card_builder_1.buildAddressListCard)(msg.fromUserName, [], 'order');
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
    async placeOrder(ctx, touser, customer, picked, addressId) {
        var _a, _b;
        const addressItems = await this.addressBook.list(ctx, customer.id);
        const addrItem = (_b = (_a = (addressId ? addressItems.find(a => a.id === addressId) : null)) !== null && _a !== void 0 ? _a : addressItems.find(a => a.isDefault)) !== null && _b !== void 0 ? _b : undefined;
        const address = addrItem
            ? { fullName: addrItem.fullName, phoneNumber: addrItem.phoneNumber, streetLine1: addrItem.streetLine1 }
            : undefined;
        if (addrItem) {
            core_1.Logger.info(`Assistant order shipping address: addressId=${addrItem.id}`, constants_1.loggerCtx);
        }
        const outcome = await this.orderService.createOrder(ctx, customer, picked.map(p => { var _a; return ({ productId: p.productId, quantity: (_a = p.quantity) !== null && _a !== void 0 ? _a : 1 }); }), address);
        switch (outcome.status) {
            case 'ok': {
                const payUrl = this.payUrl(outcome.order.code);
                core_1.Logger.info(`Assistant order created: ${outcome.order.code}`, constants_1.loggerCtx);
                return (0, card_builder_1.buildOrderSuccessText)(touser, {
                    orderCode: outcome.order.code,
                    total: outcome.order.totalWithTax,
                    items: outcome.items,
                    payUrl,
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
    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    async claimDedup(msg) {
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
        address_service_1.AddressBookService])
], AssistantService);
//# sourceMappingURL=assistant.service.js.map