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
exports.normalizePrintMode = normalizePrintMode;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const route_matrix_1 = require("./route-matrix");
const PRINT_MODES = ['off', 'onPaid', 'onAccepted'];
/** printMode 归一化：null/非法值一律回 'off'（存量行与脏配置兜底） */
function normalizePrintMode(v) {
    return PRINT_MODES.includes(v) ? v : 'off';
}
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
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
            // 外卖准入：仅餐饮行业租户展示（设计文档 2026-10-09 §4.2；存量由 BackfillWaimaiIndustryMigration 刷数）。
            // 仅过滤 C 端列表；listStoreConfigs（admin 配置视图）不过滤，避免管理员看不到已配履约的非餐饮渠道。
            if (cf.industryType !== 'catering')
                continue;
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
                businessHours: (_m = cf.waimaiBusinessHours) !== null && _m !== void 0 ? _m : null,
                errandBaseFee: (_o = cfg.errandBaseFee) !== null && _o !== void 0 ? _o : null,
                freeShippingThreshold: (_p = cfg.freeShippingThreshold) !== null && _p !== void 0 ? _p : null,
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
        const bad = ((_a = input.routesEnabled) !== null && _a !== void 0 ? _a : []).filter(r => !ROUTE_WHITELIST.includes(r));
        if (bad.length)
            throw new core_1.UserInputError(`不支持的配送路线: ${bad.join(', ')}（仅接受 R1-R5）`);
        if (input.printMode != null && !PRINT_MODES.includes(input.printMode)) {
            throw new core_1.UserInputError(`不支持的打印模式: ${input.printMode}（仅接受 off/onPaid/onAccepted）`);
        }
        const negative = ['deliveryMinutes', 'minOrderAmount', 'deliveryFee', 'errandBaseFee', 'thirdPartyBaseFee', 'freeShippingThreshold']
            .filter(k => input[k] != null && input[k] < 0);
        if (negative.length)
            throw new core_1.UserInputError(`不能为负数: ${negative.join(', ')}`);
        const timeoutKeys = ['merchantAcceptMinutes', 'externalPushTimeoutMinutes', 'externalFallbackMinutes'];
        const badTimeout = timeoutKeys.filter(k => input[k] != null && input[k] < 0);
        if (badTimeout.length)
            throw new core_1.UserInputError(`超时分钟数不能为负数: ${badTimeout.join(', ')}`);
        // 第一段承运：只有 R1（merchant|owned）、R3（campus|owned|external）可配
        const routeFirstLeg = {};
        for (const item of (_b = input.routeFirstLeg) !== null && _b !== void 0 ? _b : []) {
            const route = String((_c = item === null || item === void 0 ? void 0 : item.route) !== null && _c !== void 0 ? _c : '');
            if (route !== 'R1' && route !== 'R3') {
                throw new core_1.UserInputError(`路线 ${route || '(空)'} 不支持配置第一段承运方（仅 R1、R3）`);
            }
            const carrier = (0, route_matrix_1.normalizeRouteFirstLeg)(route, item === null || item === void 0 ? void 0 : item.carrier);
            if (!carrier) {
                throw new core_1.UserInputError(`路线 ${route} 的第一段承运方不合法: ${(_d = item === null || item === void 0 ? void 0 : item.carrier) !== null && _d !== void 0 ? _d : '(空)'}（可选 ${route_matrix_1.ROUTE_FIRST_LEG_OPTIONS[route].join('/')}）`);
            }
            routeFirstLeg[route] = carrier;
        }
        // 校园交接点：只有 R1、R2 需要；同一路线可配多个，按楼栋距离选最近，默认点做无坐标兜底
        const handoverPoints = {};
        for (const item of (_e = input.handoverPoints) !== null && _e !== void 0 ? _e : []) {
            const route = String((_f = item === null || item === void 0 ? void 0 : item.route) !== null && _f !== void 0 ? _f : '');
            if (route !== 'R1' && route !== 'R2') {
                throw new core_1.UserInputError(`路线 ${route || '(空)'} 不需要校园交接点（仅 R1、R2）`);
            }
            const name = String((_g = item === null || item === void 0 ? void 0 : item.name) !== null && _g !== void 0 ? _g : '').trim();
            const lat = Number(item === null || item === void 0 ? void 0 : item.lat);
            const lng = Number(item === null || item === void 0 ? void 0 : item.lng);
            if (!name)
                throw new core_1.UserInputError(`路线 ${route} 的交接点名称不能为空`);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                throw new core_1.UserInputError(`路线 ${route} 的交接点经纬度不合法`);
            }
            ((_h = handoverPoints[route]) !== null && _h !== void 0 ? _h : (handoverPoints[route] = [])).push(Object.assign({ name, address: ((_j = item === null || item === void 0 ? void 0 : item.address) === null || _j === void 0 ? void 0 : _j.trim()) || undefined, phone: ((_k = item === null || item === void 0 ? void 0 : item.phone) === null || _k === void 0 ? void 0 : _k.trim()) || undefined, lat,
                lng }, ((item === null || item === void 0 ? void 0 : item.isDefault) ? { isDefault: true } : {})));
        }
        // 每条路线只保留一个默认点：已标注取第一个，未标注取该路线第一个
        for (const list of Object.values(handoverPoints)) {
            let seen = false;
            for (const p of list) {
                if (p.isDefault && !seen)
                    seen = true;
                else
                    delete p.isDefault;
            }
            if (!seen && list[0])
                list[0].isDefault = true;
        }
        // 外部快递门店编号：外部快递用哪家由运营中心派单时决定，这里只存各家的门店编号
        const providerShopNo = {};
        for (const item of (_l = input.providerShopNo) !== null && _l !== void 0 ? _l : []) {
            const provider = String((_m = item === null || item === void 0 ? void 0 : item.provider) !== null && _m !== void 0 ? _m : '');
            if (provider !== 'dada' && provider !== 'meituan') {
                throw new core_1.UserInputError(`不支持的外部快递: ${provider || '(空)'}（仅 dada/meituan）`);
            }
            const shopNo = String((_o = item === null || item === void 0 ? void 0 : item.shopNo) !== null && _o !== void 0 ? _o : '').trim();
            if (shopNo)
                providerShopNo[provider] = shopNo;
        }
        const chRepo = this.connection.getRepository(ctx, core_1.Channel);
        const ch = (await chRepo.find()).find(c => Number(c.id) === Number(channelId));
        if (!ch)
            throw new core_1.UserInputError(`渠道不存在: ${channelId}`);
        const repo = this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: channelId } });
        if (!cfg)
            cfg = new campus_fulfillment_config_entity_1.CampusFulfillmentConfig({ channelId: channelId });
        // 记录「本次新开通」的路线：只有新开通 R1/R2 才强制交接点，历史配置（已开通但缺点）不阻断其它字段编辑
        const prevEnabled = [...((_p = cfg.routesEnabled) !== null && _p !== void 0 ? _p : [])];
        cfg.routesEnabled = input.routesEnabled;
        cfg.deliveryMinutes = (_q = input.deliveryMinutes) !== null && _q !== void 0 ? _q : null;
        cfg.minOrderAmount = (_r = input.minOrderAmount) !== null && _r !== void 0 ? _r : null;
        cfg.deliveryFee = (_s = input.deliveryFee) !== null && _s !== void 0 ? _s : null;
        cfg.storeAddress = (_t = input.storeAddress) !== null && _t !== void 0 ? _t : null;
        cfg.storePhone = (_u = input.storePhone) !== null && _u !== void 0 ? _u : null;
        cfg.storeNotice = (_v = input.storeNotice) !== null && _v !== void 0 ? _v : null;
        cfg.errandBaseFee = (_w = input.errandBaseFee) !== null && _w !== void 0 ? _w : null;
        // 第三方到校基价：未传即保留（旧表单不清空）；传 null 表示不接管顾客侧运费
        if (input.thirdPartyBaseFee !== undefined)
            cfg.thirdPartyBaseFee = (_x = input.thirdPartyBaseFee) !== null && _x !== void 0 ? _x : null;
        cfg.freeShippingThreshold = (_y = input.freeShippingThreshold) !== null && _y !== void 0 ? _y : null;
        cfg.notifyTemplateAccepted = (_z = input.notifyTemplateAccepted) !== null && _z !== void 0 ? _z : null;
        cfg.notifyTemplateRiderAssigned = (_0 = input.notifyTemplateRiderAssigned) !== null && _0 !== void 0 ? _0 : null;
        cfg.notifyTemplateCookingDone = (_1 = input.notifyTemplateCookingDone) !== null && _1 !== void 0 ? _1 : null;
        cfg.notifyTemplateDelivered = (_2 = input.notifyTemplateDelivered) !== null && _2 !== void 0 ? _2 : null;
        cfg.notifyTemplateExceptionHandled = (_3 = input.notifyTemplateExceptionHandled) !== null && _3 !== void 0 ? _3 : null;
        cfg.notifyTemplateOrderPlaced = (_4 = input.notifyTemplateOrderPlaced) !== null && _4 !== void 0 ? _4 : null;
        cfg.notifyTemplatePaymentPending = (_5 = input.notifyTemplatePaymentPending) !== null && _5 !== void 0 ? _5 : null;
        cfg.notifyTemplateCancelled = (_6 = input.notifyTemplateCancelled) !== null && _6 !== void 0 ? _6 : null;
        cfg.notifyTemplateAfterSales = (_7 = input.notifyTemplateAfterSales) !== null && _7 !== void 0 ? _7 : null;
        cfg.notifyTemplateAddressChanged = (_8 = input.notifyTemplateAddressChanged) !== null && _8 !== void 0 ? _8 : null;
        cfg.h5BaseUrl = (_9 = input.h5BaseUrl) !== null && _9 !== void 0 ? _9 : null;
        cfg.printMode = input.printMode == null || input.printMode === '' ? 'off' : input.printMode;
        // 超时赔付：未传即保留（旧表单不会清空已配值）
        if (input.timeoutCompensationEnabled != null)
            cfg.timeoutCompensationEnabled = input.timeoutCompensationEnabled;
        if (input.timeoutGraceMinutes != null)
            cfg.timeoutGraceMinutes = input.timeoutGraceMinutes;
        if (input.timeoutCompensationCouponTemplateId !== undefined) {
            cfg.timeoutCompensationCouponTemplateId = input.timeoutCompensationCouponTemplateId || null;
        }
        // 未传即保留：后台旧表单不认识的字段不被清空
        if (input.routeFirstLeg !== undefined)
            cfg.routeFirstLeg = input.routeFirstLeg === null ? null : routeFirstLeg;
        if (input.handoverPoints !== undefined)
            cfg.handoverPoints = input.handoverPoints === null ? null : handoverPoints;
        if (input.providerShopNo !== undefined)
            cfg.providerShopNo = input.providerShopNo === null ? null : providerShopNo;
        if (input.merchantAcceptMinutes != null)
            cfg.merchantAcceptMinutes = input.merchantAcceptMinutes;
        if (input.externalPushTimeoutMinutes != null)
            cfg.externalPushTimeoutMinutes = input.externalPushTimeoutMinutes;
        if (input.externalFallbackMinutes != null)
            cfg.externalFallbackMinutes = input.externalFallbackMinutes;
        if (input.storeLat !== undefined)
            cfg.storeLat = input.storeLat;
        if (input.storeLng !== undefined)
            cfg.storeLng = input.storeLng;
        // 动态计价：未传即保留；传 null/'' 关闭。写入前解析校验，坏 JSON 直接拒绝
        if (input.dynamicPricing !== undefined) {
            if (input.dynamicPricing === null || input.dynamicPricing.trim() === '') {
                cfg.dynamicPricing = null;
            }
            else {
                let parsed;
                try {
                    parsed = JSON.parse(input.dynamicPricing);
                }
                catch (_13) {
                    throw new core_1.UserInputError('动态计价配置不是合法 JSON');
                }
                if (!parsed || typeof parsed !== 'object')
                    throw new core_1.UserInputError('动态计价配置必须是 JSON 对象');
                cfg.dynamicPricing = parsed;
            }
        }
        // 跨字段：新开通 R1/R2 必须有至少一个可用交接点（名称+经纬度），否则订单会降级为传信者到店取餐
        const enabled = (_10 = input.routesEnabled) !== null && _10 !== void 0 ? _10 : [];
        const hasPoint = (r) => {
            var _a;
            const raw = (_a = cfg.handoverPoints) === null || _a === void 0 ? void 0 : _a[r];
            const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
            return list.some(p => { var _a; return !!String((_a = p === null || p === void 0 ? void 0 : p.name) !== null && _a !== void 0 ? _a : '').trim() && (p === null || p === void 0 ? void 0 : p.lat) != null && (p === null || p === void 0 ? void 0 : p.lng) != null; });
        };
        const missingPoint = ['R1', 'R2'].filter(r => enabled.includes(r) && !prevEnabled.includes(r) && !hasPoint(r));
        if (missingPoint.length) {
            throw new core_1.UserInputError(`开通 ${missingPoint.join('、')} 需要先填写至少一个校园交接点（名称+经纬度）`);
        }
        await repo.save(cfg);
        const address = ((_11 = input.storeAddress) !== null && _11 !== void 0 ? _11 : '').trim();
        if (address) {
            // R4：同步幂等 upsert 本渠道门店自提点（名称=店铺名，地址=storeAddress），核销走 pickup_redemption 零新表
            await this.upsertStorePickupLocation(Number(channelId), ch.code, address, ((_12 = input.storePhone) !== null && _12 !== void 0 ? _12 : '').trim() || null);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
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
            thirdPartyBaseFee: (_j = cfg === null || cfg === void 0 ? void 0 : cfg.thirdPartyBaseFee) !== null && _j !== void 0 ? _j : null,
            freeShippingThreshold: (_k = cfg === null || cfg === void 0 ? void 0 : cfg.freeShippingThreshold) !== null && _k !== void 0 ? _k : null,
            notifyTemplateAccepted: (_l = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateAccepted) !== null && _l !== void 0 ? _l : null,
            notifyTemplateRiderAssigned: (_m = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateRiderAssigned) !== null && _m !== void 0 ? _m : null,
            notifyTemplateCookingDone: (_o = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateCookingDone) !== null && _o !== void 0 ? _o : null,
            notifyTemplateDelivered: (_p = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateDelivered) !== null && _p !== void 0 ? _p : null,
            notifyTemplateExceptionHandled: (_q = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateExceptionHandled) !== null && _q !== void 0 ? _q : null,
            notifyTemplateOrderPlaced: (_r = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateOrderPlaced) !== null && _r !== void 0 ? _r : null,
            notifyTemplatePaymentPending: (_s = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplatePaymentPending) !== null && _s !== void 0 ? _s : null,
            notifyTemplateCancelled: (_t = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateCancelled) !== null && _t !== void 0 ? _t : null,
            notifyTemplateAfterSales: (_u = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateAfterSales) !== null && _u !== void 0 ? _u : null,
            notifyTemplateAddressChanged: (_v = cfg === null || cfg === void 0 ? void 0 : cfg.notifyTemplateAddressChanged) !== null && _v !== void 0 ? _v : null,
            h5BaseUrl: (_w = cfg === null || cfg === void 0 ? void 0 : cfg.h5BaseUrl) !== null && _w !== void 0 ? _w : null,
            printMode: normalizePrintMode(cfg === null || cfg === void 0 ? void 0 : cfg.printMode),
            timeoutCompensationEnabled: (_x = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutCompensationEnabled) !== null && _x !== void 0 ? _x : false,
            timeoutGraceMinutes: (_y = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutGraceMinutes) !== null && _y !== void 0 ? _y : 10,
            timeoutCompensationCouponTemplateId: (_z = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutCompensationCouponTemplateId) !== null && _z !== void 0 ? _z : null,
            routeFirstLeg: Object.entries((_0 = cfg === null || cfg === void 0 ? void 0 : cfg.routeFirstLeg) !== null && _0 !== void 0 ? _0 : {}).map(([route, carrier]) => ({ route, carrier })),
            handoverPoints: Object.entries((_1 = cfg === null || cfg === void 0 ? void 0 : cfg.handoverPoints) !== null && _1 !== void 0 ? _1 : {}).flatMap(([route, raw]) => (Array.isArray(raw) ? raw : raw ? [raw] : []).map(p => {
                var _a, _b;
                return ({
                    route,
                    name: p.name,
                    address: (_a = p.address) !== null && _a !== void 0 ? _a : null,
                    phone: (_b = p.phone) !== null && _b !== void 0 ? _b : null,
                    lat: p.lat,
                    lng: p.lng,
                    isDefault: !!p.isDefault,
                });
            })),
            providerShopNo: Object.entries((_2 = cfg === null || cfg === void 0 ? void 0 : cfg.providerShopNo) !== null && _2 !== void 0 ? _2 : {}).map(([provider, shopNo]) => ({ provider, shopNo })),
            merchantAcceptMinutes: (_3 = cfg === null || cfg === void 0 ? void 0 : cfg.merchantAcceptMinutes) !== null && _3 !== void 0 ? _3 : 5,
            externalPushTimeoutMinutes: (_4 = cfg === null || cfg === void 0 ? void 0 : cfg.externalPushTimeoutMinutes) !== null && _4 !== void 0 ? _4 : 10,
            externalFallbackMinutes: (_5 = cfg === null || cfg === void 0 ? void 0 : cfg.externalFallbackMinutes) !== null && _5 !== void 0 ? _5 : 20,
            storeLat: (_6 = cfg === null || cfg === void 0 ? void 0 : cfg.storeLat) !== null && _6 !== void 0 ? _6 : null,
            storeLng: (_7 = cfg === null || cfg === void 0 ? void 0 : cfg.storeLng) !== null && _7 !== void 0 ? _7 : null,
            dynamicPricing: (cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) ? JSON.stringify(cfg.dynamicPricing) : null,
        };
    }
};
exports.WaimaiStoreService = WaimaiStoreService;
exports.WaimaiStoreService = WaimaiStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], WaimaiStoreService);
//# sourceMappingURL=waimai-store.service.js.map