import { Injectable } from '@nestjs/common';
import { Channel, ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import { ShopTemplateVersion } from './shop-template-version.entity';
import { deepMerge, mergePreview } from './merge-config';
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
        // 保存前写快照（此时 tpl 仍为旧值）
        await this.snapshot(ctx, tpl, '更新前快照');
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
     *  未引用/引用无效（跨端、已停用）时返回 null，C 端回退 L1 全局默认（手册「不使用模板 = 全局默认」） */
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
        return null;
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

    /* --------------------- 版本快照 / 回滚 / 引用 / 合并预览 --------------------- */

    private versionRepo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, ShopTemplateVersion);
    }

    /** 写快照（保存前调用：把旧值入版本表） */
    async snapshot(ctx: RequestContext, tpl: ShopTemplate, note?: string): Promise<void> {
        const v = new ShopTemplateVersion({
            templateId: Number(tpl.id),
            version: tpl.version ?? 1,
            name: tpl.name,
            theme: tpl.theme ?? {},
            pages: tpl.pages ?? {},
            enabled: tpl.enabled ?? true,
            note,
        });
        await this.versionRepo(ctx).save(v);
    }

    /** 版本历史 */
    async versions(ctx: RequestContext, id: ID): Promise<ShopTemplateVersion[]> {
        return this.versionRepo(ctx).find({ where: { templateId: Number(id) as any }, order: { version: 'DESC' } });
    }

    /** 回滚：当前值入快照 → 目标版本写回 → version+1 */
    async restore(ctx: RequestContext, id: ID, version: number): Promise<ShopTemplate> {
        const repo = this.connection.getRepository(ctx, ShopTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) throw new UserInputError('模板不存在');
        const snap = await this.versionRepo(ctx).findOne({ where: { templateId: Number(id) as any, version } });
        if (!snap) throw new UserInputError(`版本 ${version} 不存在`);
        await this.snapshot(ctx, tpl, `回滚前备份 v${tpl.version}`);
        tpl.name = snap.name ?? tpl.name;
        tpl.theme = snap.theme ?? {};
        tpl.pages = snap.pages ?? {};
        tpl.enabled = snap.enabled ?? true;
        tpl.version = (tpl.version ?? 1) + 1;
        return repo.save(tpl);
    }

    /** 引用查询：哪些渠道引用了该模板（channel.customFields.templateId == id） */
    async references(ctx: RequestContext, id: ID): Promise<Array<{ channelId: string; channelCode: string; channelName: string; app: string }>> {
        const channels = await this.connection.getRepository(ctx, Channel).find({ loadEagerRelations: false });
        const idStr = String(id);
        return channels
            .filter((c: any) => String((c as any).customFields?.templateId ?? '') === idStr)
            .map((c: any) => ({
                channelId: String(c.id),
                channelCode: c.code,
                channelName: (c as any).customFields?.name ?? c.code,
                app: (c as any).customFields?.app ?? '',
            }));
    }

    /** 合并预览：L1 → L2 → L3 深合并，返回 merged + sourceByKey */
    async mergedPreview(
        ctx: RequestContext,
        app: TemplateApp,
        templateId?: ID,
        overrides?: any,
    ): Promise<{ merged: any; sourceByKey: Record<string, string> }> {
        const cfg = await this.findGlobalConfig(ctx, app);
        const tpl = templateId ? await this.findOne(ctx, templateId) : null;
        const l1 = { ...(cfg?.themeTokens ?? {}), ...(cfg?.defaults ?? {}) };
        const l2 = tpl ? { ...(tpl.theme ?? {}), ...(tpl.pages ?? {}) } : {};
        return mergePreview(l1, l2, overrides ?? {});
    }
}
