import { ID, RequestContext } from '@vendure/core';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyService } from './diy.service';
export declare class DiyAdminResolver {
    private service;
    constructor(service: DiyService);
    diyCategories(ctx: RequestContext, app?: string | null): Promise<DiyCategory[]>;
    diyCategory(ctx: RequestContext, id: ID): Promise<DiyCategory | null>;
    createDiyCategory(ctx: RequestContext, input: any): Promise<DiyCategory>;
    updateDiyCategory(ctx: RequestContext, input: any): Promise<DiyCategory>;
    deleteDiyCategory(ctx: RequestContext, id: ID): Promise<boolean>;
    diyMaterials(ctx: RequestContext, app?: string | null, skip?: number, take?: number): Promise<DiyMaterial[]>;
    diyMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial | null>;
    createDiyMaterial(ctx: RequestContext, input: any): Promise<DiyMaterial>;
    updateDiyMaterial(ctx: RequestContext, input: any): Promise<DiyMaterial>;
    deleteDiyMaterial(ctx: RequestContext, id: ID): Promise<boolean>;
    copyDiyMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial>;
    diyMaterialsImport(ctx: RequestContext, input: any): Promise<number>;
    diyTemplates(ctx: RequestContext, app?: string | null): Promise<DiyTemplate[]>;
    diyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate | null>;
    createDiyTemplate(ctx: RequestContext, input: any): Promise<DiyTemplate>;
    updateDiyTemplate(ctx: RequestContext, input: any): Promise<DiyTemplate>;
    deleteDiyTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    publishDiyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate>;
    copyDiyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate>;
    diyPlans(ctx: RequestContext, app?: string, status?: string, skip?: number, take?: number): Promise<{
        items: DiyPlan[];
        total: number;
    }>;
}
