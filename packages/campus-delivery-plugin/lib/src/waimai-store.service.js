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
exports.WaimaiStoreService = exports.PRIVACY_PROVIDERS = exports.PRINT_PROVIDERS = void 0;
exports.normalizePrintMode = normalizePrintMode;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const route_matrix_1 = require("./route-matrix");
const business_hours_1 = require("./business-hours");
const packing_fee_1 = require("./packing-fee");
const PRINT_MODES = ['off', 'onPaid', 'onAccepted'];
/** 打印通道白名单（P1-4）：local=本地 C-Lodop，feie=飞鹅云，yilianyun=易联云 */
exports.PRINT_PROVIDERS = ['local', 'feie', 'yilianyun'];
/** printMode 归一化：null/非法值一律回 'off'（存量行与脏配置兜底） */
function normalizePrintMode(v) {
    return PRINT_MODES.includes(v) ? v : 'off';
}
const ROUTE_WHITELIST = ['R1', 'R2', 'R3', 'R4', 'R5'];
/** 隐私号服务商白名单：mask=仅脱敏，mock=本地虚拟号，aliyun/tencent=外部号池（缺凭证自动降级为 mask） */
exports.PRIVACY_PROVIDERS = ['mask', 'mock', 'aliyun', 'tencent'];
/** 食安量化分级：A/B/C（空=未评级） */
const FOOD_GRADES = ['A', 'B', 'C'];
/** 数值配置合法区间（金额=分，时长=分钟）：与 campus-config 另一写入口同口径，超界直接拒绝 */
const INT_RANGES = {
    deliveryMinutes: [1, 240],
    minOrderAmount: [0, 10000000],
    deliveryFee: [0, 10000000],
    errandBaseFee: [0, 10000000],
    thirdPartyBaseFee: [0, 10000000],
    freeShippingThreshold: [0, 10000000],
    merchantAcceptMinutes: [0, 240],
    externalPushTimeoutMinutes: [1, 240],
    externalFallbackMinutes: [1, 240],
    packingFeeAmount: [0, 100000],
    packingFeeCap: [0, 1000000],
};
/** R4 自提点标记：campus 配置管理的本渠道门店自提点（幂等 upsert 键，复用 cjk PickupLocation 体系） */
const CAMPUS_R4_REMARK = 'campus-r4';
/** 用户侧模板消息 ID 字段：未传即保留，避免后台表单漏传把已配模板清空 */
const NOTIFY_TEMPLATE_FIELDS = [
    'notifyTemplateAccepted', 'notifyTemplateRiderAssigned', 'notifyTemplateCookingDone',
    'notifyTemplateDelivered', 'notifyTemplateExceptionHandled', 'notifyTemplateOrderPlaced',
    'notifyTemplatePaymentPending', 'notifyTemplateCancelled', 'notifyTemplateAfterSales',
    'notifyTemplateAddressChanged',
];
let WaimaiStoreService = class WaimaiStoreService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 店铺列表：有履约配置的渠道即外卖店铺（跨渠道公开元数据聚合，供 C 端首页）。
     * C 端进入店铺后用 channelToken 作 vendure-token 切换渠道拉菜单/下单。 */
    async listStores(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
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
                // 营业状态（服务端按校园时区判定，与 C 端展示/下单闸门同口径）
                openNow: (0, business_hours_1.isWithinBusinessHours)((_o = cf.waimaiBusinessHours) !== null && _o !== void 0 ? _o : null) && !cfg.paused,
                errandBaseFee: (_p = cfg.errandBaseFee) !== null && _p !== void 0 ? _p : null,
                freeShippingThreshold: (_q = cfg.freeShippingThreshold) !== null && _q !== void 0 ? _q : null,
                foodLicenseNo: (_r = cfg.foodLicenseNo) !== null && _r !== void 0 ? _r : null,
                foodLicenseImage: (_s = cfg.foodLicenseImage) !== null && _s !== void 0 ? _s : null,
                foodLicenseExpiry: (_t = cfg.foodLicenseExpiry) !== null && _t !== void 0 ? _t : null,
                foodSafetyGrade: (_u = cfg.foodSafetyGrade) !== null && _u !== void 0 ? _u : null,
                foodSafetyCommitmentImage: (_v = cfg.foodSafetyCommitmentImage) !== null && _v !== void 0 ? _v : null,
                kitchenLiveUrl: cfg.kitchenLiveEnabled ? (_w = cfg.kitchenLiveUrl) !== null && _w !== void 0 ? _w : null : null,
                kitchenLiveEnabled: cfg.kitchenLiveEnabled,
                packingFeeEnabled: (_x = cfg.packingFeeEnabled) !== null && _x !== void 0 ? _x : false,
                packingFeeMode: (0, packing_fee_1.normalizePackingFeeMode)(cfg.packingFeeMode),
                packingFeeAmount: (_y = cfg.packingFeeAmount) !== null && _y !== void 0 ? _y : 0,
                packingFeeCap: (_z = cfg.packingFeeCap) !== null && _z !== void 0 ? _z : null,
                packingFeeLabel: (_0 = cfg.packingFeeLabel) !== null && _0 !== void 0 ? _0 : null,
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
        // 路线去重：重复项会让开点校验/前端渲染出现重复楼层
        const routes = Array.from(new Set(((_a = input.routesEnabled) !== null && _a !== void 0 ? _a : []).map(r => String(r))));
        const bad = routes.filter(r => !ROUTE_WHITELIST.includes(r));
        if (bad.length)
            throw new core_1.UserInputError(`不支持的配送路线: ${bad.join(', ')}（仅接受 R1-R5）`);
        if (input.printMode != null && !PRINT_MODES.includes(input.printMode)) {
            throw new core_1.UserInputError(`不支持的打印模式: ${input.printMode}（仅接受 off/onPaid/onAccepted）`);
        }
        // 数值字段：有限数 + 区间校验 + 整数归一（金额为分），超界一律拒绝，避免脏值污染运费/超时链路
        const nums = {};
        for (const [key, [min, max]] of Object.entries(INT_RANGES)) {
            const raw = input[key];
            if (raw == null)
                continue;
            const n = Number(raw);
            if (!Number.isFinite(n))
                throw new core_1.UserInputError(`${key} 必须是数字`);
            if (n < 0)
                throw new core_1.UserInputError(`${key} 不能为负数`);
            if (n > max)
                throw new core_1.UserInputError(`${key} 超出允许上限（${max}）`);
            if (n < min)
                throw new core_1.UserInputError(`${key} 不能小于 ${min}`);
            nums[key] = Math.round(n);
        }
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
        cfg.routesEnabled = routes;
        // 未传（undefined）即保留原值，只有显式传 null 才清空：
        // 旧后台表单不认识的新字段、局部更新（如只改公告）都不会把已有配置意外抹掉。
        if (input.deliveryMinutes !== undefined)
            cfg.deliveryMinutes = (_q = nums.deliveryMinutes) !== null && _q !== void 0 ? _q : null;
        if (input.minOrderAmount !== undefined)
            cfg.minOrderAmount = (_r = nums.minOrderAmount) !== null && _r !== void 0 ? _r : null;
        if (input.deliveryFee !== undefined)
            cfg.deliveryFee = (_s = nums.deliveryFee) !== null && _s !== void 0 ? _s : null;
        if (input.storeAddress !== undefined)
            cfg.storeAddress = (_t = input.storeAddress) !== null && _t !== void 0 ? _t : null;
        if (input.storePhone !== undefined)
            cfg.storePhone = (_u = input.storePhone) !== null && _u !== void 0 ? _u : null;
        if (input.storeNotice !== undefined)
            cfg.storeNotice = (_v = input.storeNotice) !== null && _v !== void 0 ? _v : null;
        if (input.errandBaseFee !== undefined)
            cfg.errandBaseFee = (_w = nums.errandBaseFee) !== null && _w !== void 0 ? _w : null;
        // 第三方到校基价：未传即保留（旧表单不清空）；传 null 表示不接管顾客侧运费
        if (input.thirdPartyBaseFee !== undefined)
            cfg.thirdPartyBaseFee = (_x = nums.thirdPartyBaseFee) !== null && _x !== void 0 ? _x : null;
        if (input.freeShippingThreshold !== undefined)
            cfg.freeShippingThreshold = (_y = nums.freeShippingThreshold) !== null && _y !== void 0 ? _y : null;
        for (const key of NOTIFY_TEMPLATE_FIELDS) {
            if (input[key] !== undefined)
                cfg[key] = (_z = input[key]) !== null && _z !== void 0 ? _z : null;
        }
        if (input.h5BaseUrl !== undefined)
            cfg.h5BaseUrl = (_0 = input.h5BaseUrl) !== null && _0 !== void 0 ? _0 : null;
        /** 空串归一为 null（未配置即 C 端/小票不渲染）；undefined=保留原值 */
        const nullableText = (v) => (v === undefined ? undefined : String(v !== null && v !== void 0 ? v : '').trim() || null);
        if (input.printMode !== undefined) {
            cfg.printMode = input.printMode == null || input.printMode === '' ? 'off' : input.printMode;
        }
        // 云打印通道（P1-4）：local 走前端 C-Lodop；云通道必须备齐账号/设备/密钥，否则自动出票必然失败
        if (input.printProvider !== undefined && input.printProvider !== null) {
            const provider = String(input.printProvider).trim();
            if (!exports.PRINT_PROVIDERS.includes(provider)) {
                throw new core_1.UserInputError(`不支持的打印通道: ${provider || '(空)'}（仅接受 ${exports.PRINT_PROVIDERS.join('/')}）`);
            }
            cfg.printProvider = provider;
        }
        if (input.printAccount !== undefined)
            cfg.printAccount = (_1 = nullableText(input.printAccount)) !== null && _1 !== void 0 ? _1 : null;
        if (input.printDeviceSn !== undefined)
            cfg.printDeviceSn = (_2 = nullableText(input.printDeviceSn)) !== null && _2 !== void 0 ? _2 : null;
        if (input.printDeviceKey !== undefined)
            cfg.printDeviceKey = (_3 = nullableText(input.printDeviceKey)) !== null && _3 !== void 0 ? _3 : null;
        if (input.printCopies !== undefined && input.printCopies !== null) {
            const copies = Number(input.printCopies);
            if (!Number.isInteger(copies) || copies < 1 || copies > 5) {
                throw new core_1.UserInputError('打印联数必须为 1-5 的整数');
            }
            cfg.printCopies = copies;
        }
        if (cfg.printProvider !== 'local' && (!cfg.printAccount || !cfg.printDeviceSn || !cfg.printDeviceKey)) {
            throw new core_1.UserInputError('选择云打印时请填写服务商账号、设备编号与密钥');
        }
        // 超时赔付：未传即保留（旧表单不会清空已配值）
        if (input.timeoutCompensationEnabled != null)
            cfg.timeoutCompensationEnabled = input.timeoutCompensationEnabled;
        if (input.timeoutGraceMinutes != null)
            cfg.timeoutGraceMinutes = input.timeoutGraceMinutes;
        if (input.timeoutCompensationWindowHours != null) {
            const hours = Number(input.timeoutCompensationWindowHours);
            if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
                throw new core_1.UserInputError('赔付回扫窗口必须为 1-168 的整数（小时）');
            }
            cfg.timeoutCompensationWindowHours = hours;
        }
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
            cfg.merchantAcceptMinutes = nums.merchantAcceptMinutes;
        if (input.externalPushTimeoutMinutes != null)
            cfg.externalPushTimeoutMinutes = nums.externalPushTimeoutMinutes;
        if (input.externalFallbackMinutes != null)
            cfg.externalFallbackMinutes = nums.externalFallbackMinutes;
        // 门店坐标：R2/R3 距离计算与动态计价依赖，必须为有限数且在合法经纬度范围内
        for (const [key, limit] of [['storeLat', 90], ['storeLng', 180]]) {
            if (input[key] === undefined)
                continue;
            if (input[key] == null) {
                cfg[key] = null;
                continue;
            }
            const n = Number(input[key]);
            if (!Number.isFinite(n) || Math.abs(n) > limit) {
                throw new core_1.UserInputError(`${key} 不合法（需 -${limit}~${limit} 的有限数）`);
            }
            cfg[key] = n;
        }
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
                catch (_15) {
                    throw new core_1.UserInputError('动态计价配置不是合法 JSON');
                }
                if (!parsed || typeof parsed !== 'object')
                    throw new core_1.UserInputError('动态计价配置必须是 JSON 对象');
                cfg.dynamicPricing = parsed;
            }
        }
        // 号码保护：provider 白名单 + TTL 区间；外部号池缺凭证时由 PrivacyNumberService 运行时降级为脱敏
        if (input.privacyNumberEnabled != null)
            cfg.privacyNumberEnabled = !!input.privacyNumberEnabled;
        if (input.privacyNumberProvider != null) {
            const provider = String(input.privacyNumberProvider || '').trim();
            if (!exports.PRIVACY_PROVIDERS.includes(provider)) {
                throw new core_1.UserInputError(`不支持的隐私号服务商: ${provider || '(空)'}（仅接受 ${exports.PRIVACY_PROVIDERS.join('/')}）`);
            }
            cfg.privacyNumberProvider = provider;
        }
        if (input.privacyNumberTtlMinutes != null) {
            const ttl = Number(input.privacyNumberTtlMinutes);
            if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) {
                throw new core_1.UserInputError('隐私号有效期必须为 1-1440 的整数（分钟）');
            }
            cfg.privacyNumberTtlMinutes = ttl;
        }
        if (input.privacyNumberPrefix !== undefined) {
            cfg.privacyNumberPrefix = String((_4 = input.privacyNumberPrefix) !== null && _4 !== void 0 ? _4 : '').trim() || null;
        }
        // 食安公示：空串归一为 null（未配置即 C 端不渲染）；等级/到期日做格式校验
        if (input.foodLicenseNo !== undefined)
            cfg.foodLicenseNo = (_5 = nullableText(input.foodLicenseNo)) !== null && _5 !== void 0 ? _5 : null;
        if (input.foodLicenseImage !== undefined)
            cfg.foodLicenseImage = (_6 = nullableText(input.foodLicenseImage)) !== null && _6 !== void 0 ? _6 : null;
        if (input.foodSafetyCommitmentImage !== undefined) {
            cfg.foodSafetyCommitmentImage = (_7 = nullableText(input.foodSafetyCommitmentImage)) !== null && _7 !== void 0 ? _7 : null;
        }
        if (input.kitchenLiveUrl !== undefined)
            cfg.kitchenLiveUrl = (_8 = nullableText(input.kitchenLiveUrl)) !== null && _8 !== void 0 ? _8 : null;
        if (input.foodLicenseExpiry !== undefined) {
            const expiry = nullableText(input.foodLicenseExpiry);
            if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
                throw new core_1.UserInputError('食品经营许可证到期日格式必须为 YYYY-MM-DD');
            }
            cfg.foodLicenseExpiry = expiry !== null && expiry !== void 0 ? expiry : null;
        }
        if (input.foodSafetyGrade !== undefined) {
            const grade = nullableText(input.foodSafetyGrade);
            if (grade && !FOOD_GRADES.includes(grade)) {
                throw new core_1.UserInputError(`食品安全量化分级仅接受 ${FOOD_GRADES.join('/')}（空=未评级）`);
            }
            cfg.foodSafetyGrade = grade !== null && grade !== void 0 ? grade : null;
        }
        if (input.kitchenLiveEnabled != null)
            cfg.kitchenLiveEnabled = !!input.kitchenLiveEnabled;
        // 明厨亮灶入口必须真的有地址，避免 C 端出现点不开的死入口
        if (cfg.kitchenLiveEnabled && !cfg.kitchenLiveUrl) {
            throw new core_1.UserInputError('开启明厨亮灶前请先填写直播/回放地址');
        }
        // 打包费：计费方式白名单 + 金额区间（nums 已做归一），开启时金额必须 > 0 且封顶不低于金额
        if (input.packingFeeEnabled != null)
            cfg.packingFeeEnabled = !!input.packingFeeEnabled;
        if (input.packingFeeMode != null) {
            const mode = String(input.packingFeeMode || '').trim();
            if (!packing_fee_1.PACKING_FEE_MODES.includes(mode)) {
                throw new core_1.UserInputError(`不支持的打包费计费方式: ${mode || '(空)'}（仅接受 ${packing_fee_1.PACKING_FEE_MODES.join('/')}）`);
            }
            cfg.packingFeeMode = mode;
        }
        if (input.packingFeeAmount !== undefined)
            cfg.packingFeeAmount = (_9 = nums.packingFeeAmount) !== null && _9 !== void 0 ? _9 : 0;
        if (input.packingFeeCap !== undefined)
            cfg.packingFeeCap = (_10 = nums.packingFeeCap) !== null && _10 !== void 0 ? _10 : null;
        if (input.packingFeeLabel !== undefined)
            cfg.packingFeeLabel = (_11 = nullableText(input.packingFeeLabel)) !== null && _11 !== void 0 ? _11 : null;
        if (cfg.packingFeeEnabled && ((_12 = cfg.packingFeeAmount) !== null && _12 !== void 0 ? _12 : 0) <= 0) {
            throw new core_1.UserInputError('开启打包费时请填写大于 0 的金额');
        }
        if (cfg.packingFeeCap != null && cfg.packingFeeAmount != null && cfg.packingFeeCap < cfg.packingFeeAmount) {
            throw new core_1.UserInputError('打包费单笔封顶不能小于单件/每单金额');
        }
        // 跨字段：新开通 R1/R2 必须有至少一个可用交接点（名称+经纬度），否则订单会降级为传信者到店取餐
        const enabled = routes;
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
        const address = ((_13 = input.storeAddress) !== null && _13 !== void 0 ? _13 : '').trim();
        if (address) {
            // R4：同步幂等 upsert 本渠道门店自提点（名称=店铺名，地址=storeAddress），核销走 pickup_redemption 零新表
            await this.upsertStorePickupLocation(Number(channelId), ch.code, address, ((_14 = input.storePhone) !== null && _14 !== void 0 ? _14 : '').trim() || null);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28;
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
            printProvider: (_x = cfg === null || cfg === void 0 ? void 0 : cfg.printProvider) !== null && _x !== void 0 ? _x : 'local',
            printAccount: (_y = cfg === null || cfg === void 0 ? void 0 : cfg.printAccount) !== null && _y !== void 0 ? _y : null,
            printDeviceSn: (_z = cfg === null || cfg === void 0 ? void 0 : cfg.printDeviceSn) !== null && _z !== void 0 ? _z : null,
            printDeviceKey: (_0 = cfg === null || cfg === void 0 ? void 0 : cfg.printDeviceKey) !== null && _0 !== void 0 ? _0 : null,
            printCopies: (_1 = cfg === null || cfg === void 0 ? void 0 : cfg.printCopies) !== null && _1 !== void 0 ? _1 : 1,
            // 与实体默认值一致（timeoutCompensationEnabled default true）：无配置行时也应显示「已开启」
            timeoutCompensationEnabled: (_2 = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutCompensationEnabled) !== null && _2 !== void 0 ? _2 : true,
            timeoutGraceMinutes: (_3 = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutGraceMinutes) !== null && _3 !== void 0 ? _3 : 10,
            timeoutCompensationWindowHours: (_4 = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutCompensationWindowHours) !== null && _4 !== void 0 ? _4 : 24,
            timeoutCompensationCouponTemplateId: (_5 = cfg === null || cfg === void 0 ? void 0 : cfg.timeoutCompensationCouponTemplateId) !== null && _5 !== void 0 ? _5 : null,
            routeFirstLeg: Object.entries((_6 = cfg === null || cfg === void 0 ? void 0 : cfg.routeFirstLeg) !== null && _6 !== void 0 ? _6 : {}).map(([route, carrier]) => ({ route, carrier })),
            handoverPoints: Object.entries((_7 = cfg === null || cfg === void 0 ? void 0 : cfg.handoverPoints) !== null && _7 !== void 0 ? _7 : {}).flatMap(([route, raw]) => (Array.isArray(raw) ? raw : raw ? [raw] : []).map(p => {
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
            providerShopNo: Object.entries((_8 = cfg === null || cfg === void 0 ? void 0 : cfg.providerShopNo) !== null && _8 !== void 0 ? _8 : {}).map(([provider, shopNo]) => ({ provider, shopNo })),
            merchantAcceptMinutes: (_9 = cfg === null || cfg === void 0 ? void 0 : cfg.merchantAcceptMinutes) !== null && _9 !== void 0 ? _9 : 5,
            externalPushTimeoutMinutes: (_10 = cfg === null || cfg === void 0 ? void 0 : cfg.externalPushTimeoutMinutes) !== null && _10 !== void 0 ? _10 : 10,
            externalFallbackMinutes: (_11 = cfg === null || cfg === void 0 ? void 0 : cfg.externalFallbackMinutes) !== null && _11 !== void 0 ? _11 : 20,
            storeLat: (_12 = cfg === null || cfg === void 0 ? void 0 : cfg.storeLat) !== null && _12 !== void 0 ? _12 : null,
            storeLng: (_13 = cfg === null || cfg === void 0 ? void 0 : cfg.storeLng) !== null && _13 !== void 0 ? _13 : null,
            dynamicPricing: (cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) ? JSON.stringify(cfg.dynamicPricing) : null,
            privacyNumberEnabled: (_14 = cfg === null || cfg === void 0 ? void 0 : cfg.privacyNumberEnabled) !== null && _14 !== void 0 ? _14 : false,
            privacyNumberProvider: (_15 = cfg === null || cfg === void 0 ? void 0 : cfg.privacyNumberProvider) !== null && _15 !== void 0 ? _15 : 'mask',
            privacyNumberTtlMinutes: (_16 = cfg === null || cfg === void 0 ? void 0 : cfg.privacyNumberTtlMinutes) !== null && _16 !== void 0 ? _16 : 60,
            privacyNumberPrefix: (_17 = cfg === null || cfg === void 0 ? void 0 : cfg.privacyNumberPrefix) !== null && _17 !== void 0 ? _17 : null,
            foodLicenseNo: (_18 = cfg === null || cfg === void 0 ? void 0 : cfg.foodLicenseNo) !== null && _18 !== void 0 ? _18 : null,
            foodLicenseImage: (_19 = cfg === null || cfg === void 0 ? void 0 : cfg.foodLicenseImage) !== null && _19 !== void 0 ? _19 : null,
            foodLicenseExpiry: (_20 = cfg === null || cfg === void 0 ? void 0 : cfg.foodLicenseExpiry) !== null && _20 !== void 0 ? _20 : null,
            foodSafetyGrade: (_21 = cfg === null || cfg === void 0 ? void 0 : cfg.foodSafetyGrade) !== null && _21 !== void 0 ? _21 : null,
            foodSafetyCommitmentImage: (_22 = cfg === null || cfg === void 0 ? void 0 : cfg.foodSafetyCommitmentImage) !== null && _22 !== void 0 ? _22 : null,
            kitchenLiveUrl: (_23 = cfg === null || cfg === void 0 ? void 0 : cfg.kitchenLiveUrl) !== null && _23 !== void 0 ? _23 : null,
            kitchenLiveEnabled: (_24 = cfg === null || cfg === void 0 ? void 0 : cfg.kitchenLiveEnabled) !== null && _24 !== void 0 ? _24 : false,
            packingFeeEnabled: (_25 = cfg === null || cfg === void 0 ? void 0 : cfg.packingFeeEnabled) !== null && _25 !== void 0 ? _25 : false,
            packingFeeMode: (0, packing_fee_1.normalizePackingFeeMode)(cfg === null || cfg === void 0 ? void 0 : cfg.packingFeeMode),
            packingFeeAmount: (_26 = cfg === null || cfg === void 0 ? void 0 : cfg.packingFeeAmount) !== null && _26 !== void 0 ? _26 : 0,
            packingFeeCap: (_27 = cfg === null || cfg === void 0 ? void 0 : cfg.packingFeeCap) !== null && _27 !== void 0 ? _27 : null,
            packingFeeLabel: (_28 = cfg === null || cfg === void 0 ? void 0 : cfg.packingFeeLabel) !== null && _28 !== void 0 ? _28 : null,
        };
    }
};
exports.WaimaiStoreService = WaimaiStoreService;
exports.WaimaiStoreService = WaimaiStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], WaimaiStoreService);
//# sourceMappingURL=waimai-store.service.js.map