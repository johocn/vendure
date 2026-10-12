import { RequestContext } from '@vendure/core';
import { DiyOrderService } from './diy-order.service';
import { DiyGalleryList, DiyMaterialList, DiyPlanList, DiyPublicPlan, DiyShopService } from './diy-shop.service';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
export declare class DiyShopResolver {
    private service;
    private orderService;
    constructor(service: DiyShopService, orderService: DiyOrderService);
    diyMaterials(ctx: RequestContext, filter?: any): Promise<DiyMaterialList>;
    diyCategories(ctx: RequestContext): Promise<DiyCategory[]>;
    diyShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]>;
    diyShopTemplate(ctx: RequestContext, code: string): Promise<DiyTemplate | null>;
    diyGalleryPlans(ctx: RequestContext, skip?: number, take?: number): Promise<DiyGalleryList>;
    diyPublicPlan(ctx: RequestContext, id: string): Promise<DiyPublicPlan>;
    publishDiyPlan(ctx: RequestContext, id: string, isPublic: boolean): Promise<DiyPlan>;
    copyDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan>;
    createDiyPlan(ctx: RequestContext, templateCode: string, spec: any, thumb?: string | null): Promise<DiyPlan>;
    myDiyPlans(ctx: RequestContext, status?: 'draft' | 'quoted' | 'ordered', skip?: number, take?: number): Promise<DiyPlanList>;
    myDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan | null>;
    quoteDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan>;
    createOrderFromPlan(ctx: RequestContext, id: string): Promise<DiyPlan>;
}
