// 房价方案服务（P2）：CRUD + 计价策略用查询 + C 端可见性过滤
// 会员等级判定沿用 vcash-pos myMemberPrice 通道：Customer.customFields.memberLevel ?? 1
import { Injectable } from '@nestjs/common';
import { Customer, ID, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';
import { parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelRatePlan } from './rate-plan.entity';
import {
    RatePlanAdjustType,
    applyNightlyAdjustment,
    isRatePlanSaleable,
    isValidRatePlanAdjustment,
    parseMemberOnly,
} from './rate-plan-logic';

export interface HotelRatePlanInput {
    code?: string;
    name?: string;
    adjustType?: RatePlanAdjustType;
    adjustValue?: number;
    memberOnly?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    cancelPolicyOverride?: string | null;
    enabled?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HotelRatePlanService {
    constructor(private conn: TransactionalConnection) {}

    private repo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, HotelRatePlan);
    }

    /**
     * 顾客会员等级（沿用 myMemberPrice 口径：已登录者缺省按 1 档）；
     * 未登录 → null（memberOnly 方案 fail-closed 不可见）。
     */
    async resolveMemberLevel(ctx: RequestContext): Promise<number | null> {
        if (!ctx.activeUserId) return null;
        const customer = await this.conn.getRepository(ctx, Customer).findOne({
            where: { user: { id: ctx.activeUserId } } as any,
        });
        const level = (customer as any)?.customFields?.memberLevel ?? 1;
        const n = Number(level);
        return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
    }

    /** Admin：房型全部方案（含停用），按 id 升序 */
    async listByVariant(ctx: RequestContext, variantId: ID): Promise<HotelRatePlan[]> {
        return this.repo(ctx).find({
            where: { productVariantId: Number(variantId) },
            order: { id: 'ASC' },
        });
    }

    /**
     * 计价策略用：按 code 取「可套用」方案（enabled + 售卖期含入住日 + 会员达标）。
     * 任一条件不满足返回 null（= 回退基价）。与 C 端可见性同一口径（isRatePlanSaleable）。
     */
    async findApplicableByCode(
        ctx: RequestContext,
        variantId: ID,
        code: string,
        checkIn: string,
        memberLevel: number | null,
    ): Promise<HotelRatePlan | null> {
        const trimmed = typeof code === 'string' ? code.trim() : '';
        if (!trimmed) return null;
        const plan = await this.repo(ctx).findOne({
            where: { productVariantId: Number(variantId), code: trimmed },
        });
        if (!plan || !plan.enabled) return null;
        if (!isRatePlanSaleable(plan, checkIn, memberLevel)) return null;
        if (!isValidRatePlanAdjustment({ adjustType: plan.adjustType, adjustValue: plan.adjustValue })) return null;
        return plan;
    }

    /** C 端：可见方案列表（enabled + 会员过滤 + 可选入住日过滤售卖期），按 id 升序 */
    async listVisibleForCustomer(
        ctx: RequestContext,
        variantId: ID,
        options: { checkIn?: string | null } = {},
    ): Promise<Array<{ id: string; code: string; name: string; adjustType: string; adjustValue: number; memberOnly: string | null }>> {
        const plans = await this.repo(ctx).find({
            where: { productVariantId: Number(variantId), enabled: true },
            order: { id: 'ASC' },
        });
        if (!plans.length) return [];
        const memberLevel = await this.resolveMemberLevel(ctx);
        const checkIn = options.checkIn ?? null;
        // 会员门槛无条件过滤；checkIn 提供时再判售卖期（isRatePlanSaleable 内部语义）
        return plans.filter(p => isRatePlanSaleable(p, checkIn, memberLevel)).map(p => ({
            id: String(p.id),
            code: p.code,
            name: p.name,
            adjustType: p.adjustType,
            adjustValue: p.adjustValue,
            memberOnly: p.memberOnly,
        }));
    }

    /** C 端 chips：可见方案 + 日均价预估（变体基准价套用单晚方案价；坏配置基准按 0） */
    async listVisibleWithEstimate(
        ctx: RequestContext,
        variantId: ID,
        options: { checkIn?: string | null } = {},
    ): Promise<Array<{ id: string; code: string; name: string; adjustType: string; adjustValue: number; memberOnly: string | null; avgNightlyEstimateCent: number }>> {
        const plans = await this.listVisibleForCustomer(ctx, variantId, options);
        if (!plans.length) return [];
        const variant = await this.conn.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId as any },
            loadEagerRelations: false,
        });
        const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
        const base = cfg?.basePriceCent ?? 0;
        return plans.map(p => ({
            ...p,
            avgNightlyEstimateCent: applyNightlyAdjustment(base, {
                adjustType: p.adjustType as RatePlanAdjustType,
                adjustValue: p.adjustValue,
            }),
        }));
    }

    async create(ctx: RequestContext, variantId: ID, input: HotelRatePlanInput): Promise<HotelRatePlan> {
        const errors = validateRatePlanInput(input);
        if (errors.length) throw new Error(errors.join('；'));
        const repo = this.repo(ctx);
        const dup = await repo.findOne({
            where: { productVariantId: Number(variantId), code: input.code!.trim() },
        });
        if (dup) throw new Error(`方案码已存在: ${input.code!.trim()}`);
        const row = repo.create({
            productVariantId: Number(variantId),
            code: input.code!.trim(),
            name: input.name!.trim(),
            adjustType: input.adjustType!,
            adjustValue: Math.round(input.adjustValue!),
            memberOnly: normalizeMemberOnly(input.memberOnly),
            dateFrom: normalizeDate(input.dateFrom),
            dateTo: normalizeDate(input.dateTo),
            cancelPolicyOverride: normalizeCancelPolicy(input.cancelPolicyOverride),
            enabled: input.enabled ?? true,
        });
        return repo.save(row);
    }

    async update(ctx: RequestContext, planId: ID, input: HotelRatePlanInput): Promise<HotelRatePlan> {
        const repo = this.repo(ctx);
        const row = await repo.findOne({ where: { id: Number(planId) } });
        if (!row) throw new Error(`房价方案不存在: ${planId}`);
        const merged: HotelRatePlanInput = {
            code: input.code ?? row.code,
            name: input.name ?? row.name,
            adjustType: input.adjustType ?? row.adjustType,
            adjustValue: input.adjustValue ?? row.adjustValue,
            memberOnly: input.memberOnly !== undefined ? input.memberOnly : row.memberOnly,
            dateFrom: input.dateFrom !== undefined ? input.dateFrom : row.dateFrom,
            dateTo: input.dateTo !== undefined ? input.dateTo : row.dateTo,
            cancelPolicyOverride:
                input.cancelPolicyOverride !== undefined ? input.cancelPolicyOverride : row.cancelPolicyOverride,
            enabled: input.enabled ?? row.enabled,
        };
        const errors = validateRatePlanInput(merged);
        if (errors.length) throw new Error(errors.join('；'));
        if (merged.code!.trim() !== row.code) {
            const dup = await repo.findOne({
                where: { productVariantId: row.productVariantId, code: merged.code!.trim() },
            });
            if (dup && Number(dup.id) !== Number(planId)) throw new Error(`方案码已存在: ${merged.code!.trim()}`);
        }
        Object.assign(row, {
            code: merged.code!.trim(),
            name: merged.name!.trim(),
            adjustType: merged.adjustType!,
            adjustValue: Math.round(merged.adjustValue!),
            memberOnly: normalizeMemberOnly(merged.memberOnly),
            dateFrom: normalizeDate(merged.dateFrom),
            dateTo: normalizeDate(merged.dateTo),
            cancelPolicyOverride: normalizeCancelPolicy(merged.cancelPolicyOverride),
            enabled: merged.enabled,
        } as any);
        return repo.save(row);
    }

    async delete(ctx: RequestContext, planId: ID): Promise<boolean> {
        const repo = this.repo(ctx);
        const row = await repo.findOne({ where: { id: Number(planId) } });
        if (!row) return false;
        await repo.delete(Number(planId));
        return true;
    }

    /** 下单行套用校验辅助：variantIds × codes 批量取（P3 建预订单回显用） */
    async findByCodes(ctx: RequestContext, variantId: ID, codes: string[]): Promise<HotelRatePlan[]> {
        if (!codes.length) return [];
        return this.repo(ctx).find({
            where: { productVariantId: Number(variantId), code: In(codes) },
        });
    }
}

function normalizeMemberOnly(raw: string | null | undefined): string | null {
    if (raw == null || String(raw).trim() === '') return null;
    const gate = parseMemberOnly(String(raw));
    if (gate == null) return null;
    if (Number.isNaN(gate)) throw new Error(`memberOnly 必须为数字会员等级（如 '2'）`);
    if (gate < 1) throw new Error(`memberOnly 必须 ≥ 1`);
    return String(gate);
}

function normalizeDate(raw: string | null | undefined): string | null {
    if (raw == null || String(raw).trim() === '') return null;
    const d = String(raw).trim().slice(0, 10);
    if (!DATE_RE.test(d)) throw new Error(`非法日期: ${raw}`);
    return d;
}

/** cancelPolicyOverride 存 JSON 字符串；传 null/空清除；坏 JSON 或未知 type 拒绝（P4 取消政策依赖此结构） */
function normalizeCancelPolicy(raw: string | null | undefined): string | null {
    if (raw == null || String(raw).trim() === '') return null;
    const s = String(raw).trim();
    let obj: any;
    try {
        obj = JSON.parse(s);
    } catch {
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
export function validateRatePlanInput(input: HotelRatePlanInput): string[] {
    const errors: string[] = [];
    if (typeof input.code !== 'string' || !input.code.trim() || input.code.trim().length > 64) {
        errors.push('code 必须为 1-64 字符');
    }
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 255) {
        errors.push('name 必须为 1-255 字符');
    }
    if (!isValidRatePlanAdjustment({ adjustType: input.adjustType as any, adjustValue: input.adjustValue as any })) {
        if (input.adjustType !== 'discount' && input.adjustType !== 'fixed' && input.adjustType !== 'surcharge') {
            errors.push('adjustType 必须为 discount | fixed | surcharge');
        } else if (input.adjustType === 'discount') {
            errors.push('discount adjustValue 必须为 1-1000 千分比');
        } else {
            errors.push('adjustValue 必须为非负数字（fixed 需 > 0）');
        }
    }
    if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
        errors.push('dateFrom 不得晚于 dateTo');
    }
    return errors;
}
