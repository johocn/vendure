import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import {
    CreateShopTemplateInput,
    TemplateApp,
    UpdateShopGlobalConfigInput,
    UpdateShopTemplateInput,
} from './types';

@Injectable()
export class ShopTemplateService {
    constructor(private connection: TransactionalConnection) {}

    /* --------------------- 模板管理 --------------------- */

    /** 管理端：列表（可选按 app 过滤，含停用模板） */
    async findAll(ctx: RequestContext, app?: TemplateApp): Promise<ShopTemplate[]> {
        const qb = this.connection.getRepository(ctx, ShopTemplate).createQueryBuilder('tpl');
        if (app) {
            qb.andWhere('tpl.app = :app', { app });
        }
        return qb.orderBy('tpl.updatedAt', 'DESC').getMany();
    }

    /** 管理端：单个模板 */
    async findOne(ctx: RequestContext, id: ID): Promise<ShopTemplate | null> {
        return this.connection.getRepository(ctx, ShopTemplate).findOne({ where: { id: id as any } });
    }

    /** 管理端：创建（app 必填且合法） */
    async create(ctx: RequestContext, input: CreateShopTemplateInput): Promise<ShopTemplate> {
        if (input.app !== 'nshop' && input.app !== 'vshop') {
            throw new UserInputError('app 必须为 nshop 或 vshop');
        }
        const tpl = new ShopTemplate({
            name: input.name,
            app: input.app,
            theme: input.theme ?? {},
            pages: input.pages ?? {},
            version: 1,
            enabled: input.enabled ?? true,
        });
        return this.connection.getRepository(ctx, ShopTemplate).save(tpl);
    }

    /** 管理端：更新（不允许改 app） */
    async update(ctx: RequestContext, input: UpdateShopTemplateInput): Promise<ShopTemplate> {
        const repo = this.connection.getRepository(ctx, ShopTemplate);
        const tpl = await repo.findOne({ where: { id: input.id as any } });
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        if (input.name !== undefined) tpl.name = input.name;
        if (input.theme !== undefined) tpl.theme = input.theme;
        if (input.pages !== undefined) tpl.pages = input.pages;
        if (input.enabled !== undefined) tpl.enabled = input.enabled;
        return repo.save(tpl);
    }

    /** 管理端：删除 */
    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, ShopTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) {
            return false;
        }
        await repo.remove(tpl);
        return true;
    }

    /** 管理端：复制为新模板（name 加「副本」，version+1，enabled 继承） */
    async copy(ctx: RequestContext, id: ID): Promise<ShopTemplate> {
        const tpl = await this.findOne(ctx, id);
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        const copy = new ShopTemplate({
            name: `${tpl.name} 副本`,
            app: tpl.app,
            theme: tpl.theme ?? {},
            pages: tpl.pages ?? {},
            version: (tpl.version ?? 1) + 1,
            enabled: tpl.enabled,
        });
        return this.connection.getRepository(ctx, ShopTemplate).save(copy);
    }

    /** C 端：优先取店铺引用模板（显式 id → 当前渠道 channel.customFields.templateId），
     *  引用无效/未引用时回退本 app 已启用模板中最新一条 */
    async shopTemplate(ctx: RequestContext, app: TemplateApp, id?: ID): Promise<ShopTemplate | null> {
        const repo = this.connection.getRepository(ctx, ShopTemplate);
        const refId: ID | undefined =
            id ?? ((ctx.channel?.customFields as Record<string, any> | undefined)?.templateId ?? undefined);
        if (refId) {
            const tpl = await repo.findOne({ where: { id: refId as any } });
            // 引用跨端/已停用模板时回退，避免 C 端拿到不可用配置
            if (!tpl || tpl.app !== app || !tpl.enabled) {
                return null;
            }
            return tpl;
        }
        return repo
            .createQueryBuilder('tpl')
            .where('tpl.app = :app', { app })
            .andWhere('tpl.enabled = :enabled', { enabled: true })
            .orderBy('tpl.updatedAt', 'DESC')
            .getOne();
    }

    /* --------------------- 全局配置 --------------------- */

    async findGlobalConfig(ctx: RequestContext, app: TemplateApp): Promise<ShopGlobalConfig | null> {
        return this.connection.getRepository(ctx, ShopGlobalConfig).findOne({ where: { app } });
    }

    /** 管理端：更新全局配置（upsert：无记录则创建） */
    async upsertGlobalConfig(ctx: RequestContext, input: UpdateShopGlobalConfigInput): Promise<ShopGlobalConfig> {
        if (input.app !== 'nshop' && input.app !== 'vshop') {
            throw new UserInputError('app 必须为 nshop 或 vshop');
        }
        const repo = this.connection.getRepository(ctx, ShopGlobalConfig);
        let cfg = await repo.findOne({ where: { app: input.app } });
        if (!cfg) {
            cfg = new ShopGlobalConfig({ app: input.app });
        }
        if (input.themeTokens !== undefined) cfg.themeTokens = input.themeTokens;
        if (input.defaults !== undefined) cfg.defaults = input.defaults;
        return repo.save(cfg);
    }
}
