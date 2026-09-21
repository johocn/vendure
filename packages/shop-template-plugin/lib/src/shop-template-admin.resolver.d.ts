import { ID, RequestContext } from '@vendure/core';
import { ShopTemplateService } from './shop-template.service';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import { ShopTemplateVersion } from './shop-template-version.entity';
/** 引用该模板的渠道（与 SDL TemplateReference 对应） */
interface TemplateReferenceResult {
    channelId: string;
    channelCode: string;
    channelName: string;
    app: string;
}
/** 合并预览（与 SDL MergedPreview 对应） */
interface MergedPreviewResult {
    merged: any;
    sourceByKey: Record<string, string>;
}
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
    templateVersions(ctx: RequestContext, id: ID): Promise<ShopTemplateVersion[]>;
    restoreTemplateVersion(ctx: RequestContext, id: ID, version: number): Promise<ShopTemplate>;
    templateReferences(ctx: RequestContext, id: ID): Promise<TemplateReferenceResult[]>;
    templateMergedPreview(ctx: RequestContext, app: string, templateId?: ID, overrides?: any): Promise<MergedPreviewResult>;
    palettePresets(): Promise<Record<string, any>>;
}
export {};
