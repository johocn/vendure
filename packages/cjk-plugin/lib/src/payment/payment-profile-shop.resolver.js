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
exports.PaymentProfileShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const payment_profile_service_1 = require("./payment-profile.service");
let PaymentProfileShopResolver = class PaymentProfileShopResolver {
    constructor(service) {
        this.service = service;
    }
    async eligiblePaymentMethodsByProfile(ctx, profileIds) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        return this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
    }
    async eligibleInstallmentOptions(ctx, profileIds) {
        return this.service.getIntersectedInstallmentOptions(ctx, profileIds);
    }
    async checkPaymentProfileCompatibility(ctx, profileIds) {
        const methods = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        return {
            compatible: methods.length > 0,
            intersectedCount: methods.length,
        };
    }
    async eligiblePaymentMethodsWithConfig(ctx, profileIds) {
        const intersected = await this.service.getIntersectedPaymentMethods(ctx, profileIds);
        if (intersected.length === 0)
            return [];
        const configs = new Map();
        for (const pid of profileIds) {
            const rows = await this.service.getMethodConfigsByProfile(ctx, pid);
            for (const r of rows)
                configs.set(r.paymentMethodId, r);
        }
        const full = await this.service.findPaymentMethodsByIds(ctx, intersected.map(m => m.id));
        return full.map((m) => {
            var _a, _b, _c, _d, _e;
            const cfg = configs.get(m.id);
            const options = (cfg === null || cfg === void 0 ? void 0 : cfg.mode) === 'installment' ? (_a = cfg.options) !== null && _a !== void 0 ? _a : null : null;
            return { id: m.id, code: m.code, mode: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.mode) !== null && _b !== void 0 ? _b : 'installment', options, name: (_e = (_d = (_c = m.translations) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : m.code };
        });
    }
    async resolvePaymentMethodsForChannel(ctx) {
        var _a;
        const def = await this.service.getTenantDefault(ctx);
        if (def) {
            const ids = ((_a = def.paymentMethods) !== null && _a !== void 0 ? _a : []).map(m => m.id);
            const full = await this.service.findPaymentMethodsByIds(ctx, ids);
            const configs = await this.service.getMethodConfigsByProfile(ctx, def.id);
            const cm = new Map(configs.map(c => [String(c.paymentMethodId), c]));
            return full.map((m) => {
                var _a, _b, _c, _d, _e;
                const cfg = cm.get(String(m.id));
                const options = (cfg === null || cfg === void 0 ? void 0 : cfg.mode) === 'installment' ? (_a = cfg.options) !== null && _a !== void 0 ? _a : null : null;
                return { id: m.id, code: m.code, mode: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.mode) !== null && _b !== void 0 ? _b : 'installment', options, name: (_e = (_d = (_c = m.translations) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : m.code };
            });
        }
        // 无默认档案 → 返回当前可见的全部支付方式（沿用 service 既有 findAll 的租户可见过滤）
        const all = await this.service.findPaymentMethodsByIds(ctx, (await this.service.findAll(ctx)).items.flatMap(s => { var _a, _b; return (_b = (_a = s.paymentMethods) === null || _a === void 0 ? void 0 : _a.map(pm => pm.id)) !== null && _b !== void 0 ? _b : []; }));
        return all.map((m) => { var _a, _b, _c; return ({ id: m.id, code: m.code, mode: 'installment', options: null, name: (_c = (_b = (_a = m.translations) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : m.code }); });
    }
};
exports.PaymentProfileShopResolver = PaymentProfileShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "eligiblePaymentMethodsByProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "eligibleInstallmentOptions", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "checkPaymentProfileCompatibility", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('profileIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "eligiblePaymentMethodsWithConfig", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PaymentProfileShopResolver.prototype, "resolvePaymentMethodsForChannel", null);
exports.PaymentProfileShopResolver = PaymentProfileShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [payment_profile_service_1.PaymentProfileService])
], PaymentProfileShopResolver);
//# sourceMappingURL=payment-profile-shop.resolver.js.map