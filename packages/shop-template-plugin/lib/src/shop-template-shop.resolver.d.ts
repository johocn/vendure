import { ID, RequestContext } from '@vendure/core';
import { ShopTemplateService } from './shop-template.service';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
export declare class ShopTemplateShopResolver {
    private service;
    constructor(service: ShopTemplateService);
    shopTemplate(ctx: RequestContext, app: string, id?: ID): Promise<ShopTemplate | null>;
    shopGlobalConfig(ctx: RequestContext, app: string): Promise<ShopGlobalConfig | null>;
}
