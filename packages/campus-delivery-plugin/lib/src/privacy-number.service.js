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
exports.PrivacyNumberService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const waimai_store_service_1 = require("./waimai-store.service");
/**
 * 号码保护（P0）：商家/骑手/客服侧不直接拿顾客真实手机号。
 * Provider 抽象：
 * - mask：脱敏展示（零依赖，默认兜底）
 * - mock：本地虚拟号（演示用，不真实转接）
 * - aliyun / tencent：外部号池；缺凭证时运行时降级为 mask，绝不阻断订单流程
 */
let PrivacyNumberService = class PrivacyNumberService {
    constructor(connection) {
        this.connection = connection;
        /** mock 虚拟号池：同一渠道/订单/真实号在 TTL 内保持稳定 */
        this.mockPool = new Map();
    }
    /** 手机号脱敏：11 位保留前 3 后 4，其它保留首尾 */
    mask(phone) {
        const raw = String(phone !== null && phone !== void 0 ? phone : '').replace(/\s/g, '');
        if (!raw)
            return null;
        if (/^\d{11}$/.test(raw))
            return `${raw.slice(0, 3)}****${raw.slice(7)}`;
        if (raw.length >= 7)
            return `${raw.slice(0, 1)}***${raw.slice(-2)}`;
        if (raw.length >= 3)
            return `${raw.slice(0, 1)}***${raw.slice(-1)}`;
        return '***';
    }
    /** 读取渠道隐私号配置（无配置行 = 未开启） */
    async getConfig(ctx, channelId) {
        return this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: channelId },
        });
    }
    /**
     * 解析一个手机号在当前渠道下的展示方式。
     * 调用方：骑手任务联系人、商家工作台、客服台、运营侧工单。
     */
    async resolve(ctx, source) {
        var _a, _b, _c, _d, _e;
        const real = String((_a = source.phone) !== null && _a !== void 0 ? _a : '').trim();
        const cfg = await this.getConfig(ctx, source.channelId);
        if (!(cfg === null || cfg === void 0 ? void 0 : cfg.privacyNumberEnabled) || !real) {
            return { protected: false, display: real || null, callable: real || null, provider: 'off', expiresAt: null, note: null };
        }
        const configured = String((_b = cfg.privacyNumberProvider) !== null && _b !== void 0 ? _b : 'mask');
        const provider = waimai_store_service_1.PRIVACY_PROVIDERS.includes(configured) ? configured : 'mask';
        if (provider === 'mock') {
            const ttl = Math.max(1, Number((_c = cfg.privacyNumberTtlMinutes) !== null && _c !== void 0 ? _c : 60)) * 60000;
            const key = `${source.channelId}:${(_d = source.orderCode) !== null && _d !== void 0 ? _d : ''}:${real}`;
            const now = Date.now();
            const hit = this.mockPool.get(key);
            if (hit && hit.expiresAt.getTime() > now) {
                return {
                    protected: true,
                    display: hit.number,
                    callable: hit.number,
                    provider,
                    expiresAt: hit.expiresAt,
                    note: 'mock 虚拟号仅本地演示，不会真实转接',
                };
            }
            const prefix = String((_e = cfg.privacyNumberPrefix) !== null && _e !== void 0 ? _e : '').replace(/\D/g, '') || '1700000';
            const seed = Array.from(real).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 10000, 7);
            const number = `${prefix}${String(seed).padStart(4, '0')}`.slice(0, 11);
            const expiresAt = new Date(now + ttl);
            this.mockPool.set(key, { number, expiresAt });
            return {
                protected: true,
                display: number,
                callable: number,
                provider,
                expiresAt,
                note: 'mock 虚拟号仅本地演示，不会真实转接',
            };
        }
        if (provider === 'aliyun' || provider === 'tencent') {
            const envKey = provider === 'aliyun' ? 'PRIVACY_ALIYUN_KEY' : 'PRIVACY_TENCENT_KEY';
            if (!process.env[envKey]) {
                return {
                    protected: true,
                    display: this.mask(real),
                    callable: null,
                    provider: 'mask',
                    expiresAt: null,
                    note: `${provider} 号池未配置凭证（${envKey}），已降级为脱敏号`,
                };
            }
            // 号池接口按 provider 接入（AXB 绑定/解绑）；未接入前同样降级，避免给出打不通的号码
            return {
                protected: true,
                display: this.mask(real),
                callable: null,
                provider: 'mask',
                expiresAt: null,
                note: `${provider} 号池接口待接入，暂以脱敏号兜底`,
            };
        }
        return { protected: true, display: this.mask(real), callable: null, provider: 'mask', expiresAt: null, note: null };
    }
};
exports.PrivacyNumberService = PrivacyNumberService;
exports.PrivacyNumberService = PrivacyNumberService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], PrivacyNumberService);
//# sourceMappingURL=privacy-number.service.js.map