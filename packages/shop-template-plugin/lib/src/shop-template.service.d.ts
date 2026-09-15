import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
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
    /** C 端：优先按 id 取（店铺 templateId 引用），否则回退本 app 已启用模板中最新一条 */
    shopTemplate(ctx: RequestContext, app: TemplateApp, id?: ID): Promise<ShopTemplate | null>;
    findGlobalConfig(ctx: RequestContext, app: TemplateApp): Promise<ShopGlobalConfig | null>;
    /** 管理端：更新全局配置（upsert：无记录则创建） */
    upsertGlobalConfig(ctx: RequestContext, input: UpdateShopGlobalConfigInput): Promise<ShopGlobalConfig>;
}
