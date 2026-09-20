import { RequestContext } from '@vendure/core';
import { Connection } from 'typeorm';
import { MemberPriceRule, MemberPriceRuleScope } from '../entities/member-price-rule.entity';
export interface MemberPriceRuleInput {
    scope: MemberPriceRuleScope;
    categoryId?: number | null;
    memberLevel: number;
    discountPercent: number;
    active?: boolean;
    priority?: number;
}
/**
 * 会员价规则服务：
 * - 提供 CRUD（admin 管理）
 * - 提供 findEffectiveRule：按 channel + memberLevel + category 查询生效规则
 *   优先级：category > global（priority 字段大的优先）
 */
export declare class MemberPriceRuleService {
    private connection;
    constructor(connection: Connection);
    findAll(ctx: RequestContext, channelId?: number): Promise<MemberPriceRule[]>;
    findOne(id: number): Promise<MemberPriceRule | null>;
    create(ctx: RequestContext, input: MemberPriceRuleInput): Promise<MemberPriceRule>;
    update(id: number, input: Partial<MemberPriceRuleInput>): Promise<MemberPriceRule>;
    delete(id: number): Promise<boolean>;
    /**
     * 查询生效规则：先查 category（指定 categoryId + memberLevel），未命中则查 global。
     * 若同一层有多条规则，priority 大者优先；priority 相同取 discountPercent 更低（更优惠）。
     */
    findEffectiveRule(ctx: RequestContext, memberLevel: number, categoryId?: number | null): Promise<MemberPriceRule | null>;
    private validateInput;
}
