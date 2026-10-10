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
exports.HotelRatePlanService = void 0;
exports.validateRatePlanInput = validateRatePlanInput;
// 房价方案服务（P2）：CRUD + 计价策略用查询 + C 端可见性过滤
// 会员等级判定沿用 vcash-pos myMemberPrice 通道：Customer.customFields.memberLevel ?? 1
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const rate_plan_entity_1 = require("./rate-plan.entity");
const rate_plan_logic_1 = require("./rate-plan-logic");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let HotelRatePlanService = class HotelRatePlanService {
    constructor(conn) {
        this.conn = conn;
    }
    repo(ctx) {
        return this.conn.getRepository(ctx, rate_plan_entity_1.HotelRatePlan);
    }
    /**
     * 顾客会员等级（沿用 myMemberPrice 口径：已登录者缺省按 1 档）；
     * 未登录 → null（memberOnly 方案 fail-closed 不可见）。
     */
    async resolveMemberLevel(ctx) {
        var _a, _b;
        if (!ctx.activeUserId)
            return null;
        const customer = await this.conn.getRepository(ctx, core_1.Customer).findOne({
            where: { user: { id: ctx.activeUserId } },
        });
        const level = (_b = (_a = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _a === void 0 ? void 0 : _a.memberLevel) !== null && _b !== void 0 ? _b : 1;
        const n = Number(level);
        return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
    }
    /** Admin：房型全部方案（含停用），按 id 升序 */
    async listByVariant(ctx, variantId) {
        return this.repo(ctx).find({
            where: { productVariantId: Number(variantId) },
            order: { id: 'ASC' },
        });
    }
    /**
     * 计价策略用：按 code 取「可套用」方案（enabled + 售卖期含入住日 + 会员达标）。
     * 任一条件不满足返回 null（= 回退基价）。与 C 端可见性同一口径（isRatePlanSaleable）。
     */
    async findApplicableByCode(ctx, variantId, code, checkIn, memberLevel) {
        const trimmed = typeof code === 'string' ? code.trim() : '';
        if (!trimmed)
            return null;
        const plan = await this.repo(ctx).findOne({
            where: { productVariantId: Number(variantId), code: trimmed },
        });
        if (!plan || !plan.enabled)
            return null;
        if (!(0, rate_plan_logic_1.isRatePlanSaleable)(plan, checkIn, memberLevel))
            return null;
        if (!(0, rate_plan_logic_1.isValidRatePlanAdjustment)({ adjustType: plan.adjustType, adjustValue: plan.adjustValue }))
            return null;
        return plan;
    }
    /** C 端：可见方案列表（enabled + 会员过滤 + 可选入住日过滤售卖期），按 id 升序 */
    async listVisibleForCustomer(ctx, variantId, options = {}) {
        var _a;
        const plans = await this.repo(ctx).find({
            where: { productVariantId: Number(variantId), enabled: true },
            order: { id: 'ASC' },
        });
        if (!plans.length)
            return [];
        const memberLevel = await this.resolveMemberLevel(ctx);
        const checkIn = (_a = options.checkIn) !== null && _a !== void 0 ? _a : null;
        return plans
            .filter(p => !checkIn || (0, rate_plan_logic_1.isRatePlanSaleable)(p, checkIn, memberLevel))
            .map(p => ({
            id: String(p.id),
            code: p.code,
            name: p.name,
            adjustType: p.adjustType,
            adjustValue: p.adjustValue,
            memberOnly: p.memberOnly,
        }));
    }
    async create(ctx, variantId, input) {
        var _a;
        const errors = validateRatePlanInput(input);
        if (errors.length)
            throw new Error(errors.join('；'));
        const repo = this.repo(ctx);
        const dup = await repo.findOne({
            where: { productVariantId: Number(variantId), code: input.code.trim() },
        });
        if (dup)
            throw new Error(`方案码已存在: ${input.code.trim()}`);
        const row = repo.create({
            productVariantId: Number(variantId),
            code: input.code.trim(),
            name: input.name.trim(),
            adjustType: input.adjustType,
            adjustValue: Math.round(input.adjustValue),
            memberOnly: normalizeMemberOnly(input.memberOnly),
            dateFrom: normalizeDate(input.dateFrom),
            dateTo: normalizeDate(input.dateTo),
            cancelPolicyOverride: normalizeCancelPolicy(input.cancelPolicyOverride),
            enabled: (_a = input.enabled) !== null && _a !== void 0 ? _a : true,
        });
        return repo.save(row);
    }
    async update(ctx, planId, input) {
        var _a, _b, _c, _d, _e;
        const repo = this.repo(ctx);
        const row = await repo.findOne({ where: { id: Number(planId) } });
        if (!row)
            throw new Error(`房价方案不存在: ${planId}`);
        const merged = {
            code: (_a = input.code) !== null && _a !== void 0 ? _a : row.code,
            name: (_b = input.name) !== null && _b !== void 0 ? _b : row.name,
            adjustType: (_c = input.adjustType) !== null && _c !== void 0 ? _c : row.adjustType,
            adjustValue: (_d = input.adjustValue) !== null && _d !== void 0 ? _d : row.adjustValue,
            memberOnly: input.memberOnly !== undefined ? input.memberOnly : row.memberOnly,
            dateFrom: input.dateFrom !== undefined ? input.dateFrom : row.dateFrom,
            dateTo: input.dateTo !== undefined ? input.dateTo : row.dateTo,
            cancelPolicyOverride: input.cancelPolicyOverride !== undefined ? input.cancelPolicyOverride : row.cancelPolicyOverride,
            enabled: (_e = input.enabled) !== null && _e !== void 0 ? _e : row.enabled,
        };
        const errors = validateRatePlanInput(merged);
        if (errors.length)
            throw new Error(errors.join('；'));
        if (merged.code.trim() !== row.code) {
            const dup = await repo.findOne({
                where: { productVariantId: row.productVariantId, code: merged.code.trim() },
            });
            if (dup && Number(dup.id) !== Number(planId))
                throw new Error(`方案码已存在: ${merged.code.trim()}`);
        }
        Object.assign(row, {
            code: merged.code.trim(),
            name: merged.name.trim(),
            adjustType: merged.adjustType,
            adjustValue: Math.round(merged.adjustValue),
            memberOnly: normalizeMemberOnly(merged.memberOnly),
            dateFrom: normalizeDate(merged.dateFrom),
            dateTo: normalizeDate(merged.dateTo),
            cancelPolicyOverride: normalizeCancelPolicy(merged.cancelPolicyOverride),
            enabled: merged.enabled,
        });
        return repo.save(row);
    }
    async delete(ctx, planId) {
        const repo = this.repo(ctx);
        const row = await repo.findOne({ where: { id: Number(planId) } });
        if (!row)
            return false;
        await repo.delete(Number(planId));
        return true;
    }
    /** 下单行套用校验辅助：variantIds × codes 批量取（P3 建预订单回显用） */
    async findByCodes(ctx, variantId, codes) {
        if (!codes.length)
            return [];
        return this.repo(ctx).find({
            where: { productVariantId: Number(variantId), code: (0, typeorm_1.In)(codes) },
        });
    }
};
exports.HotelRatePlanService = HotelRatePlanService;
exports.HotelRatePlanService = HotelRatePlanService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], HotelRatePlanService);
function normalizeMemberOnly(raw) {
    if (raw == null || String(raw).trim() === '')
        return null;
    const gate = (0, rate_plan_logic_1.parseMemberOnly)(String(raw));
    if (gate == null)
        return null;
    if (Number.isNaN(gate))
        throw new Error(`memberOnly 必须为数字会员等级（如 '2'）`);
    if (gate < 1)
        throw new Error(`memberOnly 必须 ≥ 1`);
    return String(gate);
}
function normalizeDate(raw) {
    if (raw == null || String(raw).trim() === '')
        return null;
    const d = String(raw).trim().slice(0, 10);
    if (!DATE_RE.test(d))
        throw new Error(`非法日期: ${raw}`);
    return d;
}
/** cancelPolicyOverride 存 JSON 字符串；传 null/空清除；坏 JSON 或未知 type 拒绝（P4 取消政策依赖此结构） */
function normalizeCancelPolicy(raw) {
    if (raw == null || String(raw).trim() === '')
        return null;
    const s = String(raw).trim();
    let obj;
    try {
        obj = JSON.parse(s);
    }
    catch (_a) {
        throw new Error(`cancelPolicyOverride 必须为合法 JSON（{type:'freeUntil'|'nonRefundable', freeUntilHours?}）`);
    }
    if (!obj || typeof obj !== 'object' || (obj.type !== 'freeUntil' && obj.type !== 'nonRefundable')) {
        throw new Error(`cancelPolicyOverride.type 必须为 freeUntil | nonRefundable`);
    }
    if (obj.type === 'freeUntil' && (typeof obj.freeUntilHours !== 'number' || obj.freeUntilHours <= 0)) {
        throw new Error(`freeUntil 政策必须提供正数 freeUntilHours`);
    }
    return JSON.stringify(obj);
}
/** 输入校验（create 直校验；update 先合并再校验） */
function validateRatePlanInput(input) {
    const errors = [];
    if (typeof input.code !== 'string' || !input.code.trim() || input.code.trim().length > 64) {
        errors.push('code 必须为 1-64 字符');
    }
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 255) {
        errors.push('name 必须为 1-255 字符');
    }
    if (!(0, rate_plan_logic_1.isValidRatePlanAdjustment)({ adjustType: input.adjustType, adjustValue: input.adjustValue })) {
        if (input.adjustType !== 'discount' && input.adjustType !== 'fixed' && input.adjustType !== 'surcharge') {
            errors.push('adjustType 必须为 discount | fixed | surcharge');
        }
        else if (input.adjustType === 'discount') {
            errors.push('discount adjustValue 必须为 1-1000 千分比');
        }
        else {
            errors.push('adjustValue 必须为非负数字（fixed 需 > 0）');
        }
    }
    if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
        errors.push('dateFrom 不得晚于 dateTo');
    }
    return errors;
}
//# sourceMappingURL=rate-plan.service.js.map