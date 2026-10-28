import { ID, PaginatedList, ListQueryOptions, RequestContext, TransactionalConnection } from '@vendure/core';
import { PickupLocation } from './pickup-location.entity';
export declare class PickupLocationService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 平台渠道判定（默认商城/平台）：code === '__default_channel__'。
     * 语义镜像 order-box.service.ts 的 isMallContext。
     */
    private isPlatformContext;
    /**
     * 自提点可见规则（平台/租户分层）：
     * - 平台（默认渠道）：可见所有渠道自提点（平台运营全量自提点，含各租户自建点）。
     * - 租户：仅可见全局公共点（isPublic=true）与本租户自建点（ownerChannelId=本渠道），
     *   且需该点 channels 关联当前渠道。
     */
    private applyVisibility;
    /**
     * 是否为可管理全部自提点的上下文：平台渠道、超管或持全局点权限者。
     * 其余（租户）只能读写本渠道自建点。
     */
    private canManageAll;
    /** 当前上下文是否可读写指定自提点 */
    private canAccess;
    findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>>;
    /** 商城端：当前渠道可见且启用的自提点（不分页，按 sortOrder/创建时间排序） */
    findEnabled(ctx: RequestContext): Promise<PickupLocation[]>;
    /**
     * Vendure 生成的 filter 值是运算符对象（如 { eq: true }、{ contains: 'x' }），
     * 直接绑定到 SQL 参数会报错。这里按白名单列逐个翻译为 SQL 条件。
     * 支持 Vendure 生成的 `_and` / `_or` 嵌套与顶层 `filterOperator`（OR 时各顶层条件取并集）。
     */
    private applyFilters;
    /** 递归翻译 filter：同一层内每个字段的所有运算符先按 AND 组合，字段之间由 filterOperator 决定 */
    private buildFilterGroup;
    private buildFieldConditions;
    /**
     * 排序：按请求中的字段顺序依次应用（多字段排序全部生效）。
     * 未指定排序时默认 sortOrder 升序 + 创建时间倒序；
     * 末尾始终补 id 作为最终 tiebreaker，避免排序字段重复导致分页结果抖动/重复。
     */
    private applySorting;
    findOne(ctx: RequestContext, id: ID): Promise<PickupLocation | undefined>;
    findByType(ctx: RequestContext, type: string): Promise<PickupLocation[]>;
    /**
     * 按城市动态聚合当前渠道可见的启用自提点（rangeMode='all' 用）。
     * 语义：可见规则(公共点+本租户自建点) + 类型匹配 + enabled=true + 同 city + channels 关联当前渠道。
     * city 可为空 → 聚合当前渠道全部可见且启用的同类型自提点。
     */
    findByCityForChannel(ctx: RequestContext, city: string | null, type: string): Promise<PickupLocation[]>;
    findByIds(ctx: RequestContext, ids: ID[]): Promise<PickupLocation[]>;
    create(ctx: RequestContext, input: any): Promise<PickupLocation>;
    update(ctx: RequestContext, input: any): Promise<PickupLocation>;
    /** 软删：仅置 deletedAt，保留被订单/配送档案引用的历史数据 */
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /**
     * 校验并归一化关联门店 ID：
     * - 空值 → null（解除关联）；
     * - 非数字 → 拒绝；
     * - merchant_store 表存在时校验门店真实存在且未软删（两插件无外键，需应用层兜底）；
     * - 租户上下文只能关联「本渠道已 ACTIVE 认领」的门店，平台/超管不受限。
     *   编辑时沿用原值不做归属校验，避免历史数据被阻断。
     */
    private normalizeMerchantStoreId;
    promoteToPublic(ctx: RequestContext, id: ID): Promise<PickupLocation>;
    assignToChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void>;
    removeFromChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void>;
    sortByDistance(locations: PickupLocation[], lat: number, lng: number): Promise<PickupLocation[]>;
    private haversineDistance;
}
