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
    /** SALE 后镜像：物理驱动变体的虚拟仓 onHand 同步为 Σ 绑定物理仓 onHand（同事务） */
    syncVirtualMirror(ctx: RequestContext, sales: Sale[]): Promise<void>;
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
     */
    adjustPhysicalStock(ctx: RequestContext, variantId: ID, locationId: ID, delta: number, reason: string, meta?: LedgerMeta): Promise<void>;
    /**
     * 物理仓盘点覆盖语义：将某仓 onHand 置为绝对值 targetOnHand。
     * 返回实际差异 delta（目标-当前），写 stocktake 账本流水（meta.bizCode=单据号）。
     */
    setPhysicalStock(ctx: RequestContext, variantId: ID, locationId: ID, targetOnHand: number, reason: string, meta?: LedgerMeta): Promise<number>;
}
