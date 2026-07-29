import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { ShippingTemplateService } from './shipping-template.service';
import { ShippingTemplate } from './shipping-template.entity';
export declare class ShippingTemplateAdminResolver {
    private shippingTemplateService;
    constructor(shippingTemplateService: ShippingTemplateService);
    shippingTemplates(ctx: RequestContext, options: ListQueryOptions<ShippingTemplate>): Promise<PaginatedList<ShippingTemplate>>;
    shippingTemplate(ctx: RequestContext, id: ID): Promise<ShippingTemplate | undefined>;
    createShippingTemplate(ctx: RequestContext, input: any): Promise<ShippingTemplate>;
    updateShippingTemplate(ctx: RequestContext, input: any): Promise<ShippingTemplate>;
    deleteShippingTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    createShippingMethodFromTemplate(ctx: RequestContext, templateId: ID, name?: string, code?: string): Promise<any>;
}
