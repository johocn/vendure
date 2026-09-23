import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { StorageBin } from './storage-bin.entity';
import { StorageZone } from './storage-zone.entity';
import { VariantStorageBin } from './variant-storage-bin.entity';
import { BinOccupancyRow, VariantBinRow } from './bin-query.math';
export type BinMode = 'off' | 'zone' | 'bin';
export declare class StorageBinService {
    private connection;
    constructor(connection: TransactionalConnection);
    private tenantOf;
    /** 读渠道开关，缺省按 off（对现网零影响） */
    static resolveMode(customFields: any): BinMode;
    zones(ctx: RequestContext, stockLocationId: number): Promise<StorageZone[]>;
    bins(ctx: RequestContext, stockLocationId: number, zoneId?: number | null): Promise<StorageBin[]>;
    /** 每个库位被多少 SKU 占用（库位管理页展示用） */
    binBindCounts(ctx: RequestContext, stockLocationId: number): Promise<Map<number, number>>;
    /**
     * 生成标准库位（幂等）：已存在的库区/库位编码跳过，可重复点击补齐。
     * 返回本次新建数量，供前端提示。
     */
    generateStandard(ctx: RequestContext, stockLocationId: number): Promise<{
        zonesCreated: number;
        binsCreated: number;
    }>;
    /** 由库位反查库区（入库只传 binId 时用） */
    binZoneId(ctx: RequestContext, binId: number): Promise<number | null>;
    variantBin(ctx: RequestContext, variantId: number, stockLocationId: number): Promise<{
        zone: StorageZone | null;
        bin: StorageBin | null;
        tenantChannelId: string;
        variantId: number;
        stockLocationId: number;
        zoneId: number;
        binId: number | null;
        isDefault: boolean;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    /**
     * 归位（幂等 upsert）。
     * - bin 档：传 binId，服务端自行推导 zoneId
     * - zone 档：传 zoneId，binId 置 null
     * 入库时若 SKU 已有绑定且未显式传参，保持原绑定不动。
     */
    bind(ctx: RequestContext, input: {
        variantId: number;
        stockLocationId: number;
        zoneId: number;
        binId?: number | null;
    }): Promise<VariantStorageBin>;
    unbind(ctx: RequestContext, variantId: number, stockLocationId: number): Promise<boolean>;
    /** 删除库位前校验：有 SKU 绑定则拒绝 */
    deleteBin(ctx: RequestContext, binId: ID): Promise<boolean>;
    /** 本仓全部绑定行 → 明细行（含商品字段），供 variantBinsByLocation 过滤/排序/分页 */
    private loadVariantBinRows;
    /** 库位/库区 → SKU 明细分页（规格 §7.1 接口 1） */
    variantBinsByLocation(ctx: RequestContext, args: {
        stockLocationId: ID;
        zoneId?: ID;
        binId?: ID;
        keyword?: string;
        includeDisabled?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{
        totalItems: number;
        items: VariantBinRow[];
    }>;
    /** 全部启用库位的占用概览（含空格，喂格子宫格；规格 §7.1 接口 2） */
    binOccupancy(ctx: RequestContext, stockLocationId: ID, zoneId?: ID): Promise<BinOccupancyRow[]>;
}
