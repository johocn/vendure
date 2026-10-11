import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCategoryInput, DiyMaterialInput, DiyPluginOptions, DiyTemplateInput } from './types';
export declare class DiyService {
    private connection;
    private options;
    constructor(connection: TransactionalConnection, options: DiyPluginOptions);
    /** app 传 undefined = 全部（管理端），传 null = 仅平台 */
    findCategories(ctx: RequestContext, app?: string | null): Promise<DiyCategory[]>;
    findOneCategory(ctx: RequestContext, id: ID): Promise<DiyCategory | null>;
    createCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory>;
    updateCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory>;
    deleteCategory(ctx: RequestContext, id: ID): Promise<boolean>;
    findMaterials(ctx: RequestContext, app?: string | null, skip?: number, take?: number): Promise<DiyMaterial[]>;
    findOneMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial | null>;
    /** (app, code) 唯一性服务层校验 */
    private assertCodeFree;
    createMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial>;
    updateMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial>;
    deleteMaterial(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 租户复制平台素材 = 完全接管价库存（sourceMaterialId 回链） */
    copyMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial>;
    /**
     * 批量导入/更新素材（首批珠子库 40+ 条走这里）。
     * input = { app?: string | null, items: DiyMaterialInput[] }；按 (app, code) upsert。
     * 返回处理条数。
     */
    importMaterials(ctx: RequestContext, input: {
        app?: string | null;
        items: DiyMaterialInput[];
    }): Promise<number>;
    findTemplates(ctx: RequestContext, app?: string | null): Promise<DiyTemplate[]>;
    findOneTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate | null>;
    createTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate>;
    updateTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate>;
    deleteTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 发布：status → enabled 且 version+1（规格 §5.1） */
    publishTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate>;
    /** 租户复制平台模板改配置（同素材库哲学） */
    copyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate>;
}
