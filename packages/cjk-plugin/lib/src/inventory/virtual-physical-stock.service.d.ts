import { EventBus, ID, RequestContext, StockLevelService, StockLocation, StockLocationService, TransactionalConnection } from '@vendure/core';
import { Sale } from '@vendure/core';
import { InventoryService } from '@vendure/inventory-plugin';
import { VariantLocationBinding } from './variant-location-binding.entity';
export declare class VirtualPhysicalStockService {
    private connection;
    private stockLocationService;
    private stockLevelService;
    private inventoryService;
    private eventBus;
    constructor(connection: TransactionalConnection, stockLocationService: StockLocationService, stockLevelService: StockLevelService, inventoryService: InventoryService, eventBus: EventBus);
    virtualCode(channelCode: string): string;
    ensureVirtualLocation(ctx: RequestContext): Promise<StockLocation>;
    ensureDefaultPhysicalLocation(ctx: RequestContext): Promise<StockLocation>;
    /** 替换式写入变体绑定；校验每个仓为物理仓且归属当前租户 */
    setVariantBindings(ctx: RequestContext, variantId: ID, bindings: Array<{
        locationId: ID;
        isDefault: boolean;
    }>): Promise<VariantLocationBinding[]>;
    /** SALE 后镜像：物理驱动变体的虚拟仓 onHand 同步为 Σ 绑定物理仓 onHand（同事务） */
    syncVirtualMirror(ctx: RequestContext, sales: Sale[]): Promise<void>;
    /** 注册 SALE 阻塞处理器（镜像必须在 core 扣库同一事务内执行） */
    registerMirrorHandler(): void;
    /** 店铺端：saleableStock（虚拟仓可售）+ 物理驱动时的绑定仓明细（距离就近排序） */
    getSaleableAndDetail(ctx: RequestContext, variantId: ID, lat?: number | null, lng?: number | null): Promise<{
        variantId: ID;
        saleableStock: number;
        physicalStockEnabled: boolean;
        stockDetail: any[];
    }>;
}
