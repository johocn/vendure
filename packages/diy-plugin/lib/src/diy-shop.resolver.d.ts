import { RequestContext } from '@vendure/core';
import { DiyMaterialList, DiyPlanList, DiyShopService } from './diy-shop.service';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
export declare class DiyShopResolver {
    private service;
    constructor(service: DiyShopService);
    diyMaterials(ctx: RequestContext, filter?: any): Promise<DiyMaterialList>;
    diyShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]>;
    diyShopTemplate(ctx: RequestContext, code: string): Promise<DiyTemplate | null>;
    createDiyPlan(ctx: RequestContext, templateCode: string, spec: any, thumb?: string | null): Promise<DiyPlan>;
    myDiyPlans(ctx: RequestContext, status?: 'draft' | 'quoted' | 'ordered', skip?: number, take?: number): Promise<DiyPlanList>;
    myDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan | null>;
    quoteDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan>;
}
