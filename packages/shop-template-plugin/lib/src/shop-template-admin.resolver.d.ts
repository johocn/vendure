import { ID, RequestContext } from '@vendure/core';
import { ShopTemplateService } from './shop-template.service';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
export declare class ShopTemplateAdminResolver {
    private service;
    constructor(service: ShopTemplateService);
    shopTemplates(ctx: RequestContext, app?: string): Promise<ShopTemplate[]>;
    shopTemplate(ctx: RequestContext, id: ID): Promise<ShopTemplate | null>;
    createShopTemplate(ctx: RequestContext, input: any): Promise<ShopTemplate>;
    updateShopTemplate(ctx: RequestContext, input: any): Promise<ShopTemplate>;
    deleteShopTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    copyShopTemplate(ctx: RequestContext, id: ID): Promise<ShopTemplate>;
    shopGlobalConfig(ctx: RequestContext, app: string): Promise<ShopGlobalConfig | null>;
    updateShopGlobalConfig(ctx: RequestContext, input: any): Promise<ShopGlobalConfig>;
}
