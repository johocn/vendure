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
const card_builder_1 = require("./card-builder");
const constants_1 = require("./constants");
const credential_service_1 = require("./credential.service");
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
    constructor(opts, connection, sessionService, searchService, orderService, sender, credentialService, channelService, requestContextService) {
        this.opts = opts;
        this.connection = connection;
        this.sessionService = sessionService;
        this.searchService = searchService;
        this.orderService = orderService;
        this.sender = sender;
        this.credentialService = credentialService;
        this.channelService = channelService;
        this.requestContextService = requestContextService;
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
     * 返回 null = 无需回复（重复消息 / 非文本 / 未识别事件）。
     */
    async processMessage(msg) {
        var _a;
        // 关注事件：欢迎语；其余事件忽略（购物链路只处理文本）
        if (msg.msgType === 'event') {
            return msg.event === 'subscribe' ? (0, card_builder_1.buildWelcomeText)(msg.fromUserName) : null;
        }
        if (msg.msgType !== 'text' || !msg.content)
            return null;
        const intent = (0, intent_1.recognizeIntent)(msg.content);
        core_1.Logger.info(`Assistant intent=${intent.kind} from=${msg.fromUserName}`, constants_1.loggerCtx);
        switch (intent.kind) {
            case 'help':
                return (0, card_builder_1.buildGuideText)(msg.fromUserName, this.storefront());
            case 'bind':
                return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
            case 'search':
                return this.handleSearch(msg, intent.query, (_a = intent.quantity) !== null && _a !== void 0 ? _a : 1);
            case 'order':
                return this.handleOrder(msg, intent.indices);
        }
        return null;
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
    // ============ 下单：编号回查会话 → 绑定校验 → 建单 → 确认通知 ============
    async handleOrder(msg, indices) {
        const session = await this.sessionService.getActive(msg.fromUserName);
        if (!session) {
            return (0, card_builder_1.buildSessionExpiredText)(msg.fromUserName);
        }
        const picked = session.results.filter(r => indices.includes(r.index));
        if (!picked.length) {
            return (0, card_builder_1.buildInvalidOrderText)(msg.fromUserName, indices);
        }
        // 身份门槛：仅已绑定微信用户（openid→Customer）可下单
        const customer = await this.findCustomerByOpenid(msg.fromUserName);
        if (!customer) {
            return (0, card_builder_1.buildBindGuideText)(msg.fromUserName, this.loginUrl());
        }
        const ctx = await this.requestContextService.create({
            apiType: 'shop',
            channelOrToken: session.channelId,
        });
        const outcome = await this.orderService.createOrder(ctx, customer.id, picked.map(p => { var _a; return ({ productId: p.productId, quantity: (_a = p.quantity) !== null && _a !== void 0 ? _a : 1 }); }));
        switch (outcome.status) {
            case 'ok': {
                const payUrl = this.payUrl(outcome.order.code);
                core_1.Logger.info(`Assistant order created: ${outcome.order.code} openid=${msg.fromUserName}`, constants_1.loggerCtx);
                return (0, card_builder_1.buildOrderSuccessText)(msg.fromUserName, {
                    orderCode: outcome.order.code,
                    total: outcome.order.totalWithTax,
                    items: outcome.items,
                    payUrl,
                });
            }
            case 'out_of_stock':
            case 'no_variant':
                return (0, card_builder_1.buildOutOfStockText)(msg.fromUserName, outcome.title);
            default:
                return (0, card_builder_1.buildOrderFailText)(msg.fromUserName, outcome.message);
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
    async findCustomerByOpenid(openid) {
        const customer = await this.connection
            .getRepository(core_1.Customer)
            .findOne({ where: { customFields: { wechatOpenid: openid } } });
        return customer !== null && customer !== void 0 ? customer : null;
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
        core_1.RequestContextService])
], AssistantService);
//# sourceMappingURL=assistant.service.js.map