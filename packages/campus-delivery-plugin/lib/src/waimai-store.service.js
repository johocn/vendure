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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaimaiStoreService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const ROUTE_WHITELIST = ['R1', 'R2', 'R3', 'R4', 'R5'];
/** R4 自提点标记：campus 配置管理的本渠道门店自提点（幂等 upsert 键，复用 cjk PickupLocation 体系） */
const CAMPUS_R4_REMARK = 'campus-r4';
let WaimaiStoreService = class WaimaiStoreService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 店铺列表：有履约配置的渠道即外卖店铺（跨渠道公开元数据聚合，供 C 端首页）。
     * C 端进入店铺后用 channelToken 作 vendure-token 切换渠道拉菜单/下单。 */
    async listStores(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const configs = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, core_1.Channel).find();
        const stores = [];
        for (const ch of channels) {
            const cfg = byChannel.get(Number(ch.id));
            if (!cfg)
                continue;
            if (ch.code === '__default_channel__')
                continue; // 默认渠道是平台会话渠道，不是店铺（防脏配置污染 C 端列表/骑手大厅）
            const cf = ((_a = ch.customFields) !== null && _a !== void 0 ? _a : {});
            stores.push({
                channelId: Number(ch.id),
                channelToken: ch.token,
                name: ch.code,
                logo: (_b = cf.waimaiLogo) !== null && _b !== void 0 ? _b : null,
                tags: typeof cf.waimaiTags === 'string' && cf.waimaiTags.length
                    ? cf.waimaiTags.split(',').map((t) => t.trim()).filter(Boolean)
                    : [],
                monthlySales: (_c = cf.waimaiMonthlySales) !== null && _c !== void 0 ? _c : 0,
                promoText: (_d = cf.waimaiPromoText) !== null && _d !== void 0 ? _d : null,
                paused: cfg.paused,
                routesEnabled: (_e = cfg.routesEnabled) !== null && _e !== void 0 ? _e : [],
                deliveryMinutes: (_f = cfg.deliveryMinutes) !== null && _f !== void 0 ? _f : null,
                minOrderAmount: (_g = cfg.minOrderAmount) !== null && _g !== void 0 ? _g : null,
                deliveryFee: (_h = cfg.deliveryFee) !== null && _h !== void 0 ? _h : null,
                storeAddress: (_j = cfg.storeAddress) !== null && _j !== void 0 ? _j : null,
                storePhone: (_k = cfg.storePhone) !== null && _k !== void 0 ? _k : null,
                storeNotice: (_l = cfg.storeNotice) !== null && _l !== void 0 ? _l : null,
                errandBaseFee: (_m = cfg.errandBaseFee) !== null && _m !== void 0 ? _m : null,
                freeShippingThreshold: (_o = cfg.freeShippingThreshold) !== null && _o !== void 0 ? _o : null,
            });
        }
        return stores;
    }
    /** admin：全店铺配置（跨渠道，join Channel 取店铺名/token；默认渠道是平台会话渠道，跳过） */
    async listStoreConfigs(ctx) {
        const configs = await this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, core_1.Channel).find();
        const out = [];
        for (const ch of channels) {
            if (ch.code === '__default_channel__')
                continue;
            const cfg = byChannel.get(Number(ch.id));
            out.push(this.toConfigView(Number(ch.id), ch.code, ch.token, cfg));
        }
        return out;
    }
    /** admin：按 channelId upsert（幂等），routesEnabled 白名单 R1-R5，负数金额拒绝 */
    async updateStoreConfig(ctx, channelId, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const bad = ((_a = input.routesEnabled) !== null && _a !== void 0 ? _a : []).filter(r => !ROUTE_WHITELIST.includes(r));
        if (bad.length)
            throw new core_1.UserInputError(`不支持的配送路线: ${bad.join(', ')}（仅接受 R1-R5）`);
        const negative = ['deliveryMinutes', 'minOrderAmount', 'deliveryFee', 'errandBaseFee', 'freeShippingThreshold']
            .filter(k => input[k] != null && input[k] < 0);
        if (negative.length)
            throw new core_1.UserInputError(`不能为负数: ${negative.join(', ')}`);
        const chRepo = this.connection.getRepository(ctx, core_1.Channel);
        const ch = (await chRepo.find()).find(c => Number(c.id) === Number(channelId));
        if (!ch)
            throw new core_1.UserInputError(`渠道不存在: ${channelId}`);
        const repo = this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: channelId } });
        if (!cfg)
            cfg = new campus_fulfillment_config_entity_1.CampusFulfillmentConfig({ channelId: channelId });
        cfg.routesEnabled = input.routesEnabled;
        cfg.deliveryMinutes = (_b = input.deliveryMinutes) !== null && _b !== void 0 ? _b : null;
        cfg.minOrderAmount = (_c = input.minOrderAmount) !== null && _c !== void 0 ? _c : null;
        cfg.deliveryFee = (_d = input.deliveryFee) !== null && _d !== void 0 ? _d : null;
        cfg.storeAddress = (_e = input.storeAddress) !== null && _e !== void 0 ? _e : null;
        cfg.storePhone = (_f = input.storePhone) !== null && _f !== void 0 ? _f : null;
        cfg.storeNotice = (_g = input.storeNotice) !== null && _g !== void 0 ? _g : null;
        cfg.errandBaseFee = (_h = input.errandBaseFee) !== null && _h !== void 0 ? _h : null;
        cfg.freeShippingThreshold = (_j = input.freeShippingThreshold) !== null && _j !== void 0 ? _j : null;
        cfg.notifyTemplateAccepted = (_k = input.notifyTemplateAccepted) !== null && _k !== void 0 ? _k : null;
        cfg.notifyTemplateRiderAssigned = (_l = input.notifyTemplateRiderAssigned) !== null && _l !== void 0 ? _l : null;
        cfg.notifyTemplateCookingDone = (_m = input.notifyTemplateCookingDone) !== null && _m !== void 0 ? _m : null;
        cfg.notifyTemplateDelivered = (_o = input.notifyTemplateDelivered) !== null && _o !== void 0 ? _o : null;
        await repo.save(cfg);
        const address = ((_p = input.storeAddress) !== null && _p !== void 0 ? _p : '').trim();
        if (address) {
            // R4：同步幂等 upsert 本渠道门店自提点（名称=店铺名，地址=storeAddress），核销走 pickup_redemption 零新表
            await this.upsertStorePickupLocation(Number(channelId), ch.code, address, ((_q = input.storePhone) !== null && _q !== void 0 ? _q : '').trim() || null);
        }
        return this.toConfigView(channelId, ch.code, ch.token, cfg);
    }
    /** 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；PickupLocation 由 cjk-plugin 注册于同一进程）。
     * 可见性：isPublic=false + ownerChannelId=本渠道 + channels 含本渠道 → shop 端 applyVisibility 对本渠道可见（cjk pickup-location.service.ts:35）。 */
    async upsertStorePickupLocation(channelId, name, address, phone) {
        const repo = this.connection.rawConnection.getRepository('PickupLocation');
        const existing = await repo.findOne({ where: { ownerChannelId: channelId, remark: CAMPUS_R4_REMARK } });
        if (existing) {
            existing.name = name;
            existing.address = address;
            existing.phoneNumber = phone;
            existing.enabled = true;
            await repo.save(existing);
            return existing;
        }
        return repo.save({
            name,
            address,
            phoneNumber: phone,
            type: 'store',
            stockType: 'own',
            enabled: true,
            isPublic: false,
            ownerChannelId: channelId,
            channels: [{ id: channelId }],
            remark: CAMPUS_R4_REMARK,
        });
    }
    toConfigView(channelId, channelName, channelToken, cfg) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return {
            channelId,
            channelName,
            channelToken,
            routesEnabled: (_a = cfg === null || cfg === void 0 ? void 0 : cfg.routesEnabled) !== null && _a !== void 0 ? _a : [],
            deliveryMinutes: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.deliveryMinutes) !== null && _b !== void 0 ? _b : null,
            minOrderAmount: (_c = cfg === null || cfg === void 0 ? void 0 : cfg.minOrderAmount) !== null && _c !== void 0 ? _c : null,
            deliveryFee: (_d = cfg === null || cfg === void 0 ? void 0 : cfg.deliveryFee) !== null && _d !== void 0 ? _d : null,
            storeAddress: (_e = cfg === null || cfg === void 0 ? void 0 : cfg.storeAddress) !== null && _e !== void 0 ? _e : null,
            storePhone: (_f = cfg === null || cfg === void 0 ? void 0 : cfg.storePhone) !== null && _f !== void 0 ? _f : null,
            storeNotice: (_g = cfg === null || cfg === void 0 ? void 0 : cfg.storeNotice) !== null && _g !== void 0 ? _g : null,
            errandBaseFee: (_h = cfg === null || cfg === void 0 ? void 0 : cfg.errandBaseFee) !== null && _h !== void 0 ? _h : null,
            freeShippingThreshold: (_j = cfg === null || cfg === void 0 ? void 0 : cfg.freeShippingThreshold) !== null && _j !== void 0 ? _j : null,
            notifyTemplateAccepted: (_k = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateAccepted) !== null && _k !== void 0 ? _k : null,
            notifyTemplateRiderAssigned: (_l = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateRiderAssigned) !== null && _l !== void 0 ? _l : null,
            notifyTemplateCookingDone: (_m = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateCookingDone) !== null && _m !== void 0 ? _m : null,
            notifyTemplateDelivered: (_o = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateDelivered) !== null && _o !== void 0 ? _o : null,
        };
    }
};
exports.WaimaiStoreService = WaimaiStoreService;
exports.WaimaiStoreService = WaimaiStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], WaimaiStoreService);
//# sourceMappingURL=waimai-store.service.js.map