import { RequestContext, TransactionalConnection } from '@vendure/core';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyMaterialFilter, DiyPluginOptions } from './types';
export interface DiyMaterialList {
    items: DiyMaterial[];
    total: number;
}
/**
 * C 端查询面（规格 §7 shop 部分）。
 * app 固定取插件 init 传入的租户端，不暴露给 C 端调用方。
 */
export declare class DiyShopService {
    private options;
    private connection;
    constructor(options: DiyPluginOptions, connection: TransactionalConnection);
    private get app();
    /** C 端素材列表：两层合并去重后内存过滤 + 分页（素材量级千内，内存过滤足够） */
    findShopMaterials(ctx: RequestContext, filter?: DiyMaterialFilter): Promise<DiyMaterialList>;
    private matchKeyword;
    /** categoryCode → 该码下两层分类 id 集合（分类并集、无覆盖） */
    private categoryIdsByCode;
    /** C 端模板列表：两层 enabled 模板，同 code 租户覆盖平台（模板无复制回链列） */
    findShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]>;
    /** C 端单模板：租户优先、其次平台，仅 enabled；不存在/未启用返回 null */
    findShopTemplateByCode(ctx: RequestContext, code: string): Promise<DiyTemplate | null>;
}
