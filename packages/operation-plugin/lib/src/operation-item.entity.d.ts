import { DeepPartial, VendureEntity } from '@vendure/core';
import { OperationSection } from './operation-section.entity';
/**
 * 专区条目。
 * type: banner（图/文案/跳转）/ product（关联 core Product）/ link（纯链接）。
 * sortOrder 条目内排序（升序）。imageAssetId 关联 core Asset，productId 关联 core Product。
 */
export declare class OperationItem extends VendureEntity {
    constructor(input?: DeepPartial<OperationItem>);
    section: OperationSection;
    sectionId: number;
    type: string;
    sortOrder: number;
    title: string | null;
    imageAssetId: number | null;
    linkUrl: string | null;
    productId: number | null;
    channelId: number;
}
