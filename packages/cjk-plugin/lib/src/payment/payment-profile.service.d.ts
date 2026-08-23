import { ID, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { PaymentProfile } from './payment-profile.entity';
export declare class PaymentProfileService {
    private connection;
    constructor(connection: TransactionalConnection);
    findAll(ctx: RequestContext, options?: ListQueryOptions<PaymentProfile>): Promise<PaginatedList<PaymentProfile>>;
    findOne(ctx: RequestContext, id: ID): Promise<PaymentProfile | undefined>;
    findByCode(ctx: RequestContext, code: string): Promise<PaymentProfile | undefined>;
    create(ctx: RequestContext, input: any): Promise<PaymentProfile>;
    update(ctx: RequestContext, input: any): Promise<PaymentProfile>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    assignToVariants(ctx: RequestContext, variantIds: ID[], profileId: ID): Promise<void>;
    getIntersectedPaymentMethods(ctx: RequestContext, profileIds: ID[]): Promise<Array<{
        id: ID;
        code: string;
    }>>;
    /**
     * 按交集 id 查询完整 PaymentMethod 实体（供 Shop API 返回完整字段）
     * PaymentMethod 是 translatable 实体，需 join translations 加载 name
     */
    findPaymentMethodsByIds(ctx: RequestContext, ids: ID[]): Promise<any[]>;
    getIntersectedInstallmentOptions(ctx: RequestContext, profileIds: ID[]): Promise<Record<string, any> | null>;
    private replaceMethodConfigs;
    setTenantDefault(ctx: RequestContext, id: any): Promise<void>;
    getTenantDefault(ctx: RequestContext): Promise<PaymentProfile | undefined>;
    /**
     * 解析变体绑定的档案集合（含默认回退）：
     * - 变体绑定的档案若已停用（enabled=false），视为未绑定，回退到租户默认档案；
     * - 回退命中（含租户默认）同样排除停用档案（见 getTenantDefault）；
     * - 返回去重后的有效档案 id 列表，供交集/匹配使用，保证停用档案不参与变体绑定匹配。
     */
    resolveEffectiveProfileIds(ctx: RequestContext, profileIds: ID[]): Promise<ID[]>;
    getMethodConfigsByProfile(ctx: RequestContext, profileId: any): Promise<any[]>;
    /**
     * 为列表查询批量填充 methodConfigs，避免 schema 非空字段返回 null 导致查询整体失败。
     */
    private attachMethodConfigs;
}
