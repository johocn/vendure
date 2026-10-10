import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelRatePlan } from './rate-plan.entity';
import { RatePlanAdjustType } from './rate-plan-logic';
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
export declare class HotelRatePlanService {
    private conn;
    constructor(conn: TransactionalConnection);
    private repo;
    /**
     * 顾客会员等级（沿用 myMemberPrice 口径：已登录者缺省按 1 档）；
     * 未登录 → null（memberOnly 方案 fail-closed 不可见）。
     */
    resolveMemberLevel(ctx: RequestContext): Promise<number | null>;
    /** Admin：房型全部方案（含停用），按 id 升序 */
    listByVariant(ctx: RequestContext, variantId: ID): Promise<HotelRatePlan[]>;
    /**
     * 计价策略用：按 code 取「可套用」方案（enabled + 售卖期含入住日 + 会员达标）。
     * 任一条件不满足返回 null（= 回退基价）。与 C 端可见性同一口径（isRatePlanSaleable）。
     */
    findApplicableByCode(ctx: RequestContext, variantId: ID, code: string, checkIn: string, memberLevel: number | null): Promise<HotelRatePlan | null>;
    /** C 端：可见方案列表（enabled + 会员过滤 + 可选入住日过滤售卖期），按 id 升序 */
    listVisibleForCustomer(ctx: RequestContext, variantId: ID, options?: {
        checkIn?: string | null;
    }): Promise<Array<{
        id: string;
        code: string;
        name: string;
        adjustType: string;
        adjustValue: number;
        memberOnly: string | null;
    }>>;
    create(ctx: RequestContext, variantId: ID, input: HotelRatePlanInput): Promise<HotelRatePlan>;
    update(ctx: RequestContext, planId: ID, input: HotelRatePlanInput): Promise<HotelRatePlan>;
    delete(ctx: RequestContext, planId: ID): Promise<boolean>;
    /** 下单行套用校验辅助：variantIds × codes 批量取（P3 建预订单回显用） */
    findByCodes(ctx: RequestContext, variantId: ID, codes: string[]): Promise<HotelRatePlan[]>;
}
/** 输入校验（create 直校验；update 先合并再校验） */
export declare function validateRatePlanInput(input: HotelRatePlanInput): string[];
