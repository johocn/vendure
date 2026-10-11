import { VendureEntity } from '@vendure/core';
import { LocalizedText } from '../types';
/** DIY 分类：单表两层，app=null 平台分类（全局可见），非空=租户自建（并集，无覆盖） */
export declare class DiyCategory extends VendureEntity {
    constructor(input?: Partial<DiyCategory>);
    app: string | null;
    /** slug：crystal/agate/wood/amber/pearl/metal/gemstone；槽位 filter.categoryCodes 按它过滤 */
    code: string | null;
    parentId: number | null;
    name: LocalizedText;
    image: string | null;
    sortOrder: number;
    enabled: boolean;
}
