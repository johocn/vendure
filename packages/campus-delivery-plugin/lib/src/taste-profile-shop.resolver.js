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
exports.TasteProfileShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 口味偏好 JSON 上限（字符）：与 C 端 normalizeProfile 输出量级持平，防止超大 payload */
const MAX_LEN = 2000;
/**
 * 口味偏好云端同步（P3-1）。
 * C 端原本只存本机（utils/taste-profile.ts），换设备即丢失；
 * 此处把同一份 JSON 落到 Customer.customFields.tasteProfile（物理列 customFieldsTasteprofile），
 * 登录后 C 端拉取覆盖本地，设置页保存时上行。结构校验在 C 端 normalizeProfile 完成，
 * 服务端只保证「合法 JSON 对象 + 长度上限」。
 */
let TasteProfileShopResolver = class TasteProfileShopResolver {
    constructor(customerService, dataSource) {
        this.customerService = customerService;
        this.dataSource = dataSource;
    }
    /** 读取本人云端口味偏好：未登录返回空串（C 端游客继续用本机存储） */
    async campusMyTasteProfile(ctx) {
        var _a, _b;
        const customerId = await this.requireCustomerId(ctx, false);
        if (!customerId)
            return '';
        const rows = await this.dataSource.query(`SELECT "customFieldsTasteprofile" AS v FROM "customer" WHERE id = $1`, [customerId]);
        return (_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.v) !== null && _b !== void 0 ? _b : '';
    }
    /** 保存本人云端口味偏好：传空串代表清除 */
    async campusUpdateTasteProfile(ctx, input) {
        const customerId = await this.requireCustomerId(ctx, true);
        const raw = String(input !== null && input !== void 0 ? input : '').trim();
        if (raw.length > MAX_LEN) {
            throw new core_1.UserInputError('口味偏好数据过大（上限 2000 字符）');
        }
        if (raw) {
            let obj;
            try {
                obj = JSON.parse(raw);
            }
            catch (_a) {
                throw new core_1.UserInputError('口味偏好格式不合法');
            }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
                throw new core_1.UserInputError('口味偏好格式不合法');
            }
        }
        await this.dataSource.query(`UPDATE "customer" SET "customFieldsTasteprofile" = $2 WHERE id = $1`, [customerId, raw || null]);
        return raw;
    }
    async requireCustomerId(ctx, required) {
        if (!ctx.activeUserId) {
            if (required)
                throw new core_1.UserInputError('NOT_LOGGED_IN');
            return null;
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            if (required)
                throw new core_1.UserInputError('CUSTOMER_NOT_FOUND');
            return null;
        }
        return customer.id;
    }
};
exports.TasteProfileShopResolver = TasteProfileShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], TasteProfileShopResolver.prototype, "campusMyTasteProfile", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], TasteProfileShopResolver.prototype, "campusUpdateTasteProfile", null);
exports.TasteProfileShopResolver = TasteProfileShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.CustomerService, typeorm_1.DataSource])
], TasteProfileShopResolver);
//# sourceMappingURL=taste-profile-shop.resolver.js.map