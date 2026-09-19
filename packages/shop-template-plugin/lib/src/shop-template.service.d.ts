import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import { ShopTemplateVersion } from './shop-template-version.entity';
import { CreateShopTemplateInput, TemplateApp, UpdateShopGlobalConfigInput, UpdateShopTemplateInput } from './types';
export declare class ShopTemplateService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 管理端：列表（可选按 app 过滤，含停用模板） */
    findAll(ctx: RequestContext, app?: TemplateApp): Promise<ShopTemplate[]>;
    /** 管理端：单个模板 */
    findOne(ctx: RequestContext, id: ID): Promise<ShopTemplate | null>;
    /** 管理端：创建（app 必填且合法） */
    create(ctx: RequestContext, input: CreateShopTemplateInput): Promise<ShopTemplate>;
    /** 管理端：更新（不允许改 app） */
    update(ctx: RequestContext, input: UpdateShopTemplateInput): Promise<ShopTemplate>;
    /** 管理端：删除 */
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 管理端：复制为新模板（name 加「副本」，version+1，enabled 继承） */
    copy(ctx: RequestContext, id: ID): Promise<ShopTemplate>;
    /** C 端：优先取店铺引用模板（显式 id → 当前渠道 channel.customFields.templateId），
     *  未引用/引用无效（跨端、已停用）时返回 null，C 端回退 L1 全局默认（手册「不使用模板 = 全局默认」） */
    shopTemplate(ctx: RequestContext, app: TemplateApp, id?: ID): Promise<ShopTemplate | null>;
    findGlobalConfig(ctx: RequestContext, app: TemplateApp): Promise<ShopGlobalConfig | null>;
    /** 管理端：更新全局配置（upsert：无记录则创建） */
    upsertGlobalConfig(ctx: RequestContext, input: UpdateShopGlobalConfigInput): Promise<ShopGlobalConfig>;
    private versionRepo;
    /** 写快照（保存前调用：把旧值入版本表） */
    snapshot(ctx: RequestContext, tpl: ShopTemplate, note?: string): Promise<void>;
    /** 版本历史 */
    versions(ctx: RequestContext, id: ID): Promise<ShopTemplateVersion[]>;
    /** 回滚：当前值入快照 → 目标版本写回 → version+1 */
    restore(ctx: RequestContext, id: ID, version: number): Promise<ShopTemplate>;
    /** 引用查询：哪些渠道引用了该模板（channel.customFields.templateId == id） */
    references(ctx: RequestContext, id: ID): Promise<Array<{
        channelId: string;
        channelCode: string;
        channelName: string;
        app: string;
    }>>;
    /** 合并预览：L1 → L2 → L3 深合并，返回 merged + sourceByKey */
    mergedPreview(ctx: RequestContext, app: TemplateApp, templateId?: ID, overrides?: any): Promise<{
        merged: any;
        sourceByKey: Record<string, string>;
    }>;
}
