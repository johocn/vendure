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
    getMethodConfigsByProfile(ctx: RequestContext, profileId: any): Promise<any[]>;
}
