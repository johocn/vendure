import { RequestContext } from '@vendure/core';
import { DiyMaterialList, DiyShopService } from './diy-shop.service';
import { DiyTemplate } from './entities/diy-template.entity';
export declare class DiyShopResolver {
    private service;
    constructor(service: DiyShopService);
    diyMaterials(ctx: RequestContext, filter?: any): Promise<DiyMaterialList>;
    diyShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]>;
    diyShopTemplate(ctx: RequestContext, code: string): Promise<DiyTemplate | null>;
}
