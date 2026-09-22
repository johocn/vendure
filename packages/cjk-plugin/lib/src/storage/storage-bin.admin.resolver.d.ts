import { ID, RequestContext } from '@vendure/core';
import { StorageBinService } from './storage-bin.service';
/** 库位/库区管理（三档开关共用同一套接口，差异只在前端门控） */
export declare class StorageBinAdminResolver {
    private storageBinService;
    constructor(storageBinService: StorageBinService);
    storageZones(ctx: RequestContext, stockLocationId: ID): Promise<import("./storage-zone.entity").StorageZone[]>;
    storageBins(ctx: RequestContext, args: any): Promise<import("./storage-bin.entity").StorageBin[]>;
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
    generateStandardBins(ctx: RequestContext, stockLocationId: ID): Promise<{
        zonesCreated: number;
        binsCreated: number;
    }>;
    bindVariantToBin(ctx: RequestContext, input: any): Promise<import("./variant-storage-bin.entity").VariantStorageBin>;
    unbindVariantFromBin(ctx: RequestContext, args: any): Promise<boolean>;
    deleteStorageBin(ctx: RequestContext, id: ID): Promise<boolean>;
}
