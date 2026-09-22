import { ID, RequestContext } from '@vendure/core';
import { StorageBinService } from './storage-bin.service';
/** C 端只读：展示某 SKU 的库区/库位（三档差异由前端门控） */
export declare class StorageBinShopResolver {
    private storageBinService;
    constructor(storageBinService: StorageBinService);
    variantBin(ctx: RequestContext, args: any): Promise<{
        zone: import("./storage-zone.entity").StorageZone | null;
        bin: import("./storage-bin.entity").StorageBin | null;
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
    storageZones(ctx: RequestContext, stockLocationId: ID): Promise<import("./storage-zone.entity").StorageZone[]>;
}
