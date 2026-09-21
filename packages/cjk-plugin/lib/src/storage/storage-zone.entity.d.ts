import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
export declare class StorageZone extends VendureEntity {
    constructor(input?: DeepPartial<StorageZone>);
    tenantChannelId: string;
    stockLocationId: number;
    /** 库区字母，如 A */
    code: string;
    /** 库区名称，如「常温存储区」 */
    name: string;
    /** 拣货顺序，A→B→C→D */
    sortOrder: number;
    enabled: boolean;
}
