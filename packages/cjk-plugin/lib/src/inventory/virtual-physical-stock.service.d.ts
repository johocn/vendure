import { Channel, EventBus, ID, RequestContext, StockLevelService, StockLocation, StockLocationService, TransactionalConnection } from '@vendure/core';
import { Sale } from '@vendure/core';
import { InventoryService, LedgerMeta } from '@vendure/inventory-plugin';
import { VariantLocationBinding } from './variant-location-binding.entity';
import { DeliveryRecordService } from '../delivery/delivery-record.service';
/** 租户内单个仓摘要（web-admin 库存网点页唯一数据源） */
export interface TenantLocationSummary {
    id: string;
    name: string;
    code: string;
    kind: string;
    isSystem: boolean;
    deliveryMethods: string[] | null;
    serviceCities: string[] | null;
    lat: number | null;
    lng: number | null;
}
/** 租户库存方案概览：开关口径 + 系统仓落点 + 仓清单 */
export interface TenantInventoryOverview {
    channelCode: string;
    physicalStockEnabled: boolean;
    virtualCode: string;
    virtualLocationId: string | null;
    defaultPhysicalCode: string;
    defaultPhysicalLocationId: string | null;
    locations: TenantLocationSummary[];
}
export interface TenantLocationInput {
    name?: string;
    deliveryMethods?: string[] | null;
    serviceCities?: string[] | null;
    lat?: number | null;
    lng?: number | null;
}
/** 配送方式归一：只收白名单取值、去重；空数组 → null（null 语义 = 邮寄与自提都支持） */
export declare function normalizeDeliveryMethods(input?: string[] | null): string[] | null;
/** 服务城市归一：去空去重；空 → null（null 语义 = 全国可达） */
export declare function normalizeCities(input?: string[] | null): string[] | null;
export declare class VirtualPhysicalStockService {
    private connection;
    private stockLocationService;
    private stockLevelService;
    private inventoryService;
    private eventBus;
    private deliveryRecordService;
    constructor(connection: TransactionalConnection, stockLocationService: StockLocationService, stockLevelService: StockLevelService, inventoryService: InventoryService, eventBus: EventBus, deliveryRecordService: DeliveryRecordService);
    virtualCode(channelCode: string): string;
    /** 系统仓：默认物理仓（code=租户编码）与虚拟仓（code=租户编码-virtual）——不可改码、不可删除 */
    isSystemLocationCode(channelCode: string, code: string): boolean;
    /**
     * 盘库目标仓守卫（2026-09-27 D51 定稿口径，D52 起为唯一实现）：
     * 校验规则跟**渠道库存模式**走，不跟仓的 kind 硬绑。
     * - `physicalStockEnabled = true`：账面权威在物理仓，虚拟仓只是 Σ 绑定物理仓的镜像。
     *   允许写虚拟仓会让同一 SKU 出现「盘点账面（虚拟仓）」与「可售账面（物理仓）」两个口径，
     *   且下一次任何镜像触发就把刚写的数冲掉 → 必须要求物理仓。
     * - `physicalStockEnabled = false`（纯虚拟库存店）：店内没有物理仓维度，虚拟仓就是唯一账面 → 放行。
     *   生产 t1/t2/t3 等店的开关都是关的，一刀切拒虚拟仓会直接废掉在用处法。
     *
     * 调用方（必须共用这一份，避免口径漂移）：
     * - `stocktake/stocktake.service.ts` 的 `createTask` / `updateTask`（协同盘库任务绑仓）；
     * - `inventory/stock-doc.service.ts` 的 STOCKTAKE 分支（库存明细页「调整」「快捷盘点」入口）。
     */
    assertStocktakeLocationAllowed(ctx: RequestContext, stockLocationId: number): Promise<void>;
    private findLocationByCode;
    /**
     * 仓归属校验：channelCode 命中、或 code 等于租户编码 / `{租户编码}-*` 前缀。
     * 两者皆空的历史数据视为「当前渠道内未打标」，按可见即归属处理（否则旧网点会凭空消失）。
     */
    private codeBelongsToTenant;
    /** 当前渠道可见的仓（channel-aware，天然排除其它租户渠道的仓） */
    private channelLocations;
    /** 系统仓自愈：kind/code/channelCode 与规格不符时按规格回写（幂等，不触碰其它字段） */
    private patchSystemLocation;
    ensureVirtualLocation(ctx: RequestContext, channel?: Channel): Promise<StockLocation>;
    ensureDefaultPhysicalLocation(ctx: RequestContext, channel?: Channel): Promise<StockLocation>;
    /** 租户库存方案概览：开关口径 + 系统仓落点 + 本租户仓清单（web-admin「库存网点」唯一数据源） */
    getTenantInventoryOverview(ctx: RequestContext, channel?: Channel): Promise<TenantInventoryOverview>;
    /** 幂等补建系统仓：虚拟仓恒在；开关开启时补默认物理仓。返回概览供前端直接刷新 */
    ensureTenantInventoryLocations(ctx: RequestContext, channel?: Channel): Promise<TenantInventoryOverview>;
    /** 租户内下一个附加物理仓编码：`{租户编码}-{两位序号}`，占用则顺延 */
    private nextTenantLocationCode;
    /** 取当前渠道可见且归属本租户的仓（越权/跨租户一律拒绝） */
    private findTenantLocation;
    /**
     * 新建租户物理仓。编码与性质由服务端生成（`{租户编码}-{两位序号}` / physical），
     * 归属强制落当前租户——前端不可指定，避免出现「无编码/非物理仓」而无法绑定变体的仓。
     */
    createTenantPhysicalLocation(ctx: RequestContext, input: TenantLocationInput, channel?: Channel): Promise<TenantInventoryOverview>;
    /**
     * 更新租户仓（名称/配送方式/服务城市/坐标）。
     * 编码与性质不可改：系统虚拟仓整体禁改；默认物理仓强制 kind=physical；
     * 历史未打标数据仅补归属 channelCode，不改 kind/code（避免库存口径漂移）。
     */
    updateTenantPhysicalLocation(ctx: RequestContext, input: TenantLocationInput & {
        id: ID;
    }, channel?: Channel): Promise<TenantInventoryOverview>;
    /** 删除租户仓；系统仓（默认物理仓 / 虚拟仓）不可删除 */
    deleteTenantPhysicalLocation(ctx: RequestContext, id: ID, channel?: Channel): Promise<TenantInventoryOverview>;
    /**
     * 删仓前置安全校验：core 的 delete 未传 transferToLocationId 时会级联删除该仓全部 StockLevel
     * （库存静默蒸发），因此仍有库存 / 被变体绑定 / 有未完成出库预留时一律拒绝。
     */
    private assertLocationDeletable;
    /** 替换式写入变体绑定；校验每个仓为物理仓且归属当前租户 */
    setVariantBindings(ctx: RequestContext, variantId: ID, bindings: Array<{
        locationId: ID;
        isDefault: boolean;
    }>): Promise<VariantLocationBinding[]>;
    /**
     * 租户侧读取：该变体在本店的物理仓绑定（变体必须属于当前渠道；只回本租户仓）。
     * 与平台侧 `setVariantBindings` 同一张表，仅入口权限不同。
     */
    getTenantVariantBindings(ctx: RequestContext, variantId: ID): Promise<VariantLocationBinding[]>;
    /**
     * 租户侧写入：替换式写入该变体的物理仓绑定。
     * 为什么单开一个租户级入口：平台侧 `setVariantBindings` 的
     * `@Allow(InventoryPermissions.ViewStock)` 是 inventory-plugin 的超管语义全局库存权限，
     * 不在租户角色白名单内 → 租户账号调用恒 403（与 D41/D42 同病根）。
     * 归属校验沿用 `setVariantBindings`（物理仓 + code 前缀属于当前租户），不放宽核心 @Allow。
     */
    setTenantVariantBindings(ctx: RequestContext, variantId: ID, bindings: Array<{
        locationId: ID;
        isDefault: boolean;
    }>): Promise<VariantLocationBinding[]>;
    /** 变体必须存在且已分配给当前渠道（避免租户越权读写他店变体） */
    private assertVariantInChannel;
    /** SALE 后镜像：物理驱动变体的虚拟仓 onHand 同步为 Σ 绑定物理仓 onHand（同事务） */
    syncVirtualMirror(ctx: RequestContext, sales: Sale[]): Promise<void>;
    /**
     * 镜像同步（多变体版，2026-09-27 抽出）：把各变体虚拟仓 onHand 拉齐为 Σ 绑定物理仓 onHand。
     * 与 SALE 处理器同源；「物理仓写入原语」写完后也调用它，避免可售口径滞后到下次销售才拉齐。
     * 幂等：每次现算 Σ 绑定仓 onHand，delta=0 不写流水；只写虚拟仓，且不会触发 SALE 事件，不会递归。
     */
    syncVirtualMirrorForVariants(ctx: RequestContext, variantIds: Array<ID | string>): Promise<void>;
    /** 目标仓是否虚拟仓（kind=virtual）；读不到按「非虚拟」处理（保守：仍做镜像同步） */
    private isVirtualLocation;
    /**
     * 写入原语「补镜像」守卫（2026-09-27 口径修正）：
     * 只有写物理仓才需要拉齐虚拟镜像；写入目标本身就是虚拟仓时直接跳过——
     * 那属于「直接写账面」，再跑镜像会用 Σ 绑定仓覆盖刚写入的值（无绑定时直接写成 0），把账面写坏。
     * 生产现存 t1/t2/t3 等纯虚拟库存店的盘点正是写虚拟仓（24 个存量任务全部指向虚拟仓），必须走这条早退。
     */
    private syncMirrorAfterWrite;
    /** 注册 SALE 阻塞处理器（镜像必须在 core 扣库同一事务内执行；配送记录同步同事务防漏单） */
    registerMirrorHandler(): void;
    /** SALE 后生成顾客配送记录（方案2-B）；pickup 订单标记自提模式 */
    syncDeliveryRecords(ctx: RequestContext, sales: Sale[]): Promise<void>;
    /** 店铺端：saleableStock（虚拟仓可售）+ 物理驱动时的绑定仓明细（距离就近排序） */
    getSaleableAndDetail(ctx: RequestContext, variantId: ID, lat?: number | null, lng?: number | null, city?: string | null, deliveryMethod?: 'MAIL' | 'SELF_PICKUP' | null): Promise<{
        variantId: ID;
        saleableStock: number;
        physicalStockEnabled: boolean;
        stockDetail: any[];
    }>;
    /**
     * 统一物理仓调库原语（单据/预留单/订单钩子共用）：
     * delta>0 入库、delta<0 出库。负 delta 校验物理仓 onHand 充足，不足抛「物理库存不足」。
     * 复用 inventory-plugin 的 adjustStockPublic：写 StockAdjustment 流水 + 可选 OrderStockLedger 账本。
     * 写完即补虚拟镜像（2026-09-27）——否则物理仓已变、虚拟仓（可售口径）要等下次 SALE 才拉齐。
     */
    adjustPhysicalStock(ctx: RequestContext, variantId: ID, locationId: ID, delta: number, reason: string, meta?: LedgerMeta): Promise<void>;
    /**
     * 物理仓盘点覆盖语义：将某仓 onHand 置为绝对值 targetOnHand。
     * 返回实际差异 delta（目标-当前），写 stocktake 账本流水（meta.bizCode=单据号）。
     * 写完即补虚拟镜像（2026-09-27）；目标仓为虚拟仓时由守卫自动跳过（纯虚拟库存店的盘点写虚拟仓）。
     */
    setPhysicalStock(ctx: RequestContext, variantId: ID, locationId: ID, targetOnHand: number, reason: string, meta?: LedgerMeta): Promise<number>;
}
