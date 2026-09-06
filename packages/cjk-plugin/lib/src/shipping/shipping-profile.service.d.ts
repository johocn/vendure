import { ID, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShippingProfile } from './shipping-profile.entity';
import { PickupLocation } from '../pickup/pickup-location.entity';
import { PickupLocationService } from '../pickup/pickup-location.service';
import { PaymentProfile } from '../payment/payment-profile.entity';
import { PaymentProfileService } from '../payment/payment-profile.service';
export declare class ShippingProfileService {
    private connection;
    private pickupLocationService;
    private paymentProfileService;
    constructor(connection: TransactionalConnection, pickupLocationService: PickupLocationService, paymentProfileService: PaymentProfileService);
    findAll(ctx: RequestContext, options?: ListQueryOptions<ShippingProfile>): Promise<PaginatedList<ShippingProfile>>;
    findOne(ctx: RequestContext, id: any): Promise<ShippingProfile | undefined>;
    findByCode(ctx: RequestContext, code: string): Promise<ShippingProfile | undefined>;
    create(ctx: RequestContext, input: any): Promise<ShippingProfile>;
    update(ctx: RequestContext, input: any): Promise<ShippingProfile>;
    delete(ctx: RequestContext, id: ID): Promise<void>;
    assignToVariants(ctx: RequestContext, variantIds: ID[], profileId: ID): Promise<void>;
    getIntersectedShippingMethods(ctx: RequestContext, profileIds: ID[]): Promise<Array<{
        id: ID;
        code: string;
    }>>;
    /**
     * 按交集 id 查询完整 ShippingMethod 实体（供 Shop API 返回完整字段）
     * ShippingMethod 是 translatable 实体，需 join translations 加载 name
     */
    findShippingMethodsByIds(ctx: RequestContext, ids: ID[]): Promise<any[]>;
    /**
     * 获取多个 Profile 的自提点交集。
     * 规则：
     * - 任一 Profile 的 pickupLocations 为空（未约束）→ 视为该 Profile 不约束，跳过
     * - 所有约束了的 Profile 的 pickupLocations 取交集
     * - 若所有 Profile 都未约束，返回 null（表示不限制，前端展示全部自提点）
     * - 若交集为空但至少有一个约束，返回 []（表示无可用自提点）
     */
    getIntersectedPickupLocations(ctx: RequestContext, profileIds: ID[]): Promise<ID[] | null>;
    /**
     * 结合 per-method config 的自提点取 Profile 交集。
     * 规则：Profile 的 methodConfigs 中有 pickup 类 mode（pickup/store/employee）且带自提点范围时，
     * 以其 config 中的自提点作为该 Profile 的约束；否则回退到档案级 pickupLocations。
     * 其余语义与 getIntersectedPickupLocations 一致：
     * - 全部未约束 → null；有约束但交集为空 → []。
     */
    getIntersectedPickupLocationsWithConfig(ctx: RequestContext, profileIds: ID[]): Promise<ID[] | null>;
    /**
     * 查询是否任一 Profile 约束了自提点。
     * 前端用此区分 eligiblePickupLocationsByProfile 返回 [] 的两种情况：
     * - false → 未约束，前端展示全部自提点
     * - true  → 约束了但交集为空，前端展示"无可用自提点"
     */
    hasPickupLocationConstraint(ctx: RequestContext, profileIds: ID[]): Promise<boolean>;
    /**
     * 方式 mode → 自提点实体类型映射：
     * - pickup → point
     * - store  → store
     * - employee → employee
     */
    private pickupTypeByMode;
    /**
     * pickup 类 mode 判定（C 端解析/交集门控用）：
     * 'pickup'(自提点) / 'store'(门店自提) / 'employee'(职工单位) 均视为自提方式，
     * 仅 'mail' 为邮寄。
     */
    private isPickupMode;
    /**
     * 自提类计算器判定（门店自提/自提点/职工单位）。
     */
    private isPickupCalculator;
    /**
     * 按配送方式计算器判定其自提点实体类型。
     * 门店自提/自提点/职工单位共用 mode='pickup' 之场景（历史前端默认值），
     * 必须以 calculator 为准，否则 store-pickup-calculator 会被误判成 'point'。
     * 非自提计算器返回 null（交由 pickupTypeByMode 回退）。
     */
    private pickupTypeForMethod;
    /**
     * 计算箱的履约类型与候选自提点。
     * 箱型不能只看 profile.pickupLocations（新版前端把自提点放在方式级 methodConfig 里，
     * profile.pickupLocations 常为空），须按「档案可用配送方式是否为自提类」判定，
     * 否则门店自提/自提点/职工单位箱会被判成 delivery → C 端误显物理地址块。
     * pickupLocations = 档案级点 ∪ 各自提方式有效点（同城全部→渠道可见启用点，指定→方式限定点）。
     */
    resolveBoxFulfilment(ctx: RequestContext, profile?: ShippingProfile): Promise<{
        type: 'pickup' | 'delivery';
        pickupLocations: PickupLocation[];
    }>;
    /**
     * 计算某一方式 config 的有效自提点 id 集合（shop 端透传 & 交集用）。
     * - options.rangeMode === 'all' → 动态聚合当前渠道可见的启用自提点，且仅取该方式对应类型
     *   （pickup→point）。city 来源不明确，采用"同 channel 的全部可见启用 point"聚合。
     * - 否则 → options.pickupLocationIds，并限定在对应类型内（pickup→point / store→store / employee→employee）。
     */
    getEffectivePickupIdsForConfig(ctx: RequestContext, cfg: any): Promise<ID[]>;
    findPickupLocationsByIds(ctx: RequestContext, ids: ID[]): Promise<PickupLocation[]>;
    private replaceMethodConfigs;
    setTenantDefault(ctx: RequestContext, id: any): Promise<void>;
    getTenantDefault(ctx: RequestContext): Promise<ShippingProfile | undefined>;
    /**
     * 取配送档案绑定的支付档案；
     * 未绑定时回退到对应租户的默认支付档案（复用 PaymentProfileService.getTenantDefault）。
     */
    getPaymentProfileForShippingProfile(ctx: RequestContext, shippingProfileId: ID): Promise<PaymentProfile | undefined>;
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
