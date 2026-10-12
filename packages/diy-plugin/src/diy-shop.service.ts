import { Inject, Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, ForbiddenError, UserInputError } from '@vendure/core';
import { CALC_VERSION } from '@diy/calc';
import { IsNull } from 'typeorm';

import { PLUGIN_INIT_OPTIONS, DEFAULT_QUOTE_TTL_DAYS } from './constants';
import { buildQuoteNo, quoteExpiresAt } from './quote-utils';
import { runDiyCalc, toPlanBom } from './calc-bridge';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { parseTemplateConfig } from './template-config';
import { mergeMaterials, unionCategories } from './material-merge';
import { coverMaterialIds, derivePlanTitle } from './plan-utils';
import { DiyMaterialFilter, DiyPlanSpec, DiyPluginOptions } from './types';

export interface DiyMaterialList {
    items: DiyMaterial[];
    total: number;
}

export interface DiyPlanList {
    items: DiyPlan[];
    total: number;
}

/** 画廊条目（v2 公开橱窗）：title 派生自 bom 快照，authorName 实体暂无归属人昵称列 → null */
export interface DiyGalleryItem {
    id: string;
    title: string;
    coverMaterialIds: string[];
    totalAmount: number;
    totalCount: number;
    authorName: string | null;
    createdAt: Date;
}

export interface DiyGalleryList {
    items: DiyGalleryItem[];
    total: number;
}

export interface DiyPublicPlan {
    id: string;
    title: string;
    spec: DiyPlanSpec;
    totalAmount: number;
    totalCount: number;
    createdAt: Date;
}

/**
 * C 端查询面（规格 §7 shop 部分）。
 * app 固定取插件 init 传入的租户端，不暴露给 C 端调用方。
 */
@Injectable()
export class DiyShopService {
    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private connection: TransactionalConnection,
    ) {}

    private get app(): string {
        return this.options.app ?? 'nshop';
    }

    /** C 端素材列表：两层合并去重后内存过滤 + 分页（素材量级千内，内存过滤足够） */
    async findShopMaterials(ctx: RequestContext, filter: DiyMaterialFilter = {}): Promise<DiyMaterialList> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: IsNull() }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        let items = mergeMaterials(platform, tenant);

        if (filter.categoryCode) {
            const allowed = (await this.categoryIdsByCode(ctx)).get(filter.categoryCode) ?? new Set<number>();
            items = items.filter(m => allowed.has(m.categoryId));
        }
        if (filter.categoryId != null) {
            items = items.filter(m => m.categoryId === filter.categoryId);
        }
        if (filter.shapes?.length) {
            items = items.filter(m => filter.shapes!.includes(m.shape));
        }
        if (filter.diameterMin != null || filter.diameterMax != null) {
            items = items.filter(
                m =>
                    m.diameter != null &&
                    (filter.diameterMin == null || m.diameter >= filter.diameterMin!) &&
                    (filter.diameterMax == null || m.diameter <= filter.diameterMax!),
            );
        }
        const kw = filter.keyword?.trim().toLowerCase();
        if (kw) {
            items = items.filter(m => this.matchKeyword(m, kw));
        }
        if (filter.onlyEnabled) {
            items = items.filter(m => m.enabled);
        }

        const total = items.length;
        const skip = filter.skip ?? 0;
        const take = filter.take ?? 50;
        return { items: items.slice(skip, skip + take), total };
    }

    /** C 端分类列表：平台 + 租户两层并集（无覆盖），仅 enabled，sortOrder 升序 */
    async findShopCategories(ctx: RequestContext): Promise<DiyCategory[]> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: IsNull() } }),
            repo.find({ where: { app: this.app } }),
        ]);
        return unionCategories(platform, tenant);
    }

    private matchKeyword(m: DiyMaterial, kw: string): boolean {
        if (m.code.toLowerCase().includes(kw)) {
            return true;
        }
        const values = typeof m.name === 'string' ? [m.name] : Object.values(m.name ?? {});
        return values.some(v => typeof v === 'string' && v.toLowerCase().includes(kw));
    }

    /** categoryCode → 该码下两层分类 id 集合（分类并集、无覆盖） */
    private async categoryIdsByCode(ctx: RequestContext): Promise<Map<string, Set<number>>> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cats = await repo.find();
        const map = new Map<string, Set<number>>();
        for (const c of cats) {
            if (!c.code) {
                continue;
            }
            const set = map.get(c.code) ?? new Set<number>();
            set.add(c.id as number);
            map.set(c.code, set);
        }
        return map;
    }

    /** C 端模板列表：两层 enabled 模板，同 code 租户覆盖平台（模板无复制回链列） */
    async findShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: IsNull(), status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app, status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        const tenantCodes = new Set(tenant.map(t => t.code));
        return [...platform.filter(p => !tenantCodes.has(p.code)), ...tenant];
    }

    /** C 端单模板：租户优先、其次平台，仅 enabled；不存在/未启用返回 null */
    async findShopTemplateByCode(ctx: RequestContext, code: string): Promise<DiyTemplate | null> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tenant = await repo.findOne({ where: { app: this.app, code, status: 'enabled' } });
        if (tenant) {
            return tenant;
        }
        return repo.findOne({ where: { app: IsNull(), code, status: 'enabled' } });
    }

    /* ------------------------- 方案（规格 §6.2） ------------------------- */

    /** C 端创建方案（可匿名演示）：required 槽位校验 → 合并素材 → 服务端复算 → draft 落库（价格快照） */
    async createDiyPlan(
        ctx: RequestContext,
        input: { templateCode: string; spec: DiyPlanSpec; thumb?: string | null },
    ): Promise<DiyPlan> {
        const template = await this.findShopTemplateByCode(ctx, input.templateCode);
        if (!template) {
            throw new UserInputError(`Diy template not found: ${input.templateCode}`);
        }
        const parsed = parseTemplateConfig(template.config);
        if (!parsed) {
            throw new UserInputError(`Invalid template config: ${template.code}`);
        }
        for (const slot of parsed.slots) {
            if (slot.required && !input.spec.slots[slot.key]?.materialId) {
                throw new UserInputError(`Slot "${slot.key}" is required`);
            }
        }
        // 仅启用素材参与复算：素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = runDiyCalc(template, input.spec, materialList.items, ctx.languageCode);
        return this.connection.getRepository(ctx, DiyPlan).save(
            new DiyPlan({
                app: this.app,
                userId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
                templateId: Number(template.id),
                templateVersion: template.version,
                status: 'draft',
                spec: input.spec,
                bom: toPlanBom(bom),
                calcVersion: CALC_VERSION,
                thumb: input.thumb ?? null,
            }),
        );
    }

    /** 我的方案列表（未登录返回空页） */
    async myDiyPlans(
        ctx: RequestContext,
        options: { status?: 'draft' | 'quoted' | 'ordered'; skip?: number; take?: number } = {},
    ): Promise<DiyPlanList> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return { items: [], total: 0 };
        }
        const [items, total] = await this.connection
            .getRepository(ctx, DiyPlan)
            .findAndCount({
                where: {
                    app: this.app,
                    userId: Number(userId),
                    ...(options.status ? { status: options.status } : {}),
                },
                order: { createdAt: 'DESC', id: 'DESC' },
                skip: options.skip ?? 0,
                take: options.take ?? 20,
            });
        return { items, total };
    }

    /** 我的方案详情（仅本人可见，他人/跨租户一律 null） */
    async myDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan | null> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return null;
        }
        const plan = await this.connection
            .getRepository(ctx, DiyPlan)
            .findOne({ where: { app: this.app, id: Number(id) } });
        return plan && plan.userId === Number(userId) ? plan : null;
    }

    /** 报价（规格 §6.3）：draft/quoted 可重复报价（每次以服务端实时价复算覆盖 bom，新号新效期）；ordered 不可 */
    async quoteDiyPlan(ctx: RequestContext, planId: string): Promise<DiyPlan> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(planId) } });
        if (!plan || plan.userId !== Number(userId)) {
            throw new UserInputError(`Diy plan not found: ${planId}`);
        }
        if (plan.status === 'ordered') {
            throw new UserInputError(`Diy plan ${plan.id} already ordered`);
        }
        const template = await this.connection
            .getRepository(ctx, DiyTemplate)
            .findOne({ where: { id: plan.templateId } });
        if (!template || template.status !== 'enabled') {
            throw new UserInputError(`Diy template not available`);
        }
        // 服务端实时价为唯一价格权威；素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = runDiyCalc(template, plan.spec, materialList.items, ctx.languageCode);
        const now = new Date();
        plan.status = 'quoted';
        plan.bom = toPlanBom(bom);
        plan.calcVersion = CALC_VERSION;
        plan.quoteNo = buildQuoteNo(now);
        plan.expiresAt = quoteExpiresAt(now, DEFAULT_QUOTE_TTL_DAYS);
        return repo.save(plan);
    }

    /* ------------------------- v2：公开分享 / 画廊 ------------------------- */

    private toGalleryItem(plan: DiyPlan): DiyGalleryItem {
        return {
            id: String(plan.id),
            title: derivePlanTitle(plan.spec, plan.bom),
            coverMaterialIds: coverMaterialIds(plan.spec),
            totalAmount: plan.bom?.totalAmount ?? 0,
            totalCount: plan.bom?.totalCount ?? 0,
            authorName: null,
            createdAt: plan.createdAt,
        };
    }

    /** 公开画廊：仅 isPublic=true，按发布时间倒序，take 上限 50 */
    async diyGalleryPlans(
        ctx: RequestContext,
        options: { skip?: number; take?: number } = {},
    ): Promise<DiyGalleryList> {
        const [plans, total] = await this.connection
            .getRepository(ctx, DiyPlan)
            .findAndCount({
                where: { app: this.app, isPublic: true },
                order: { publishedAt: 'DESC', id: 'DESC' },
                skip: options.skip ?? 0,
                take: Math.min(Math.max(1, options.take ?? 12), 50),
            });
        return { items: plans.map(p => this.toGalleryItem(p)), total };
    }

    /** 公开方案详情（分享页）：仅 isPublic=true，否则统一 PLAN_NOT_ACCESSIBLE（不暴露存在性） */
    async diyPublicPlan(ctx: RequestContext, id: string): Promise<DiyPublicPlan> {
        const plan = await this.connection
            .getRepository(ctx, DiyPlan)
            .findOne({ where: { app: this.app, id: Number(id), isPublic: true } });
        if (!plan) {
            throw new UserInputError('PLAN_NOT_ACCESSIBLE');
        }
        return {
            id: String(plan.id),
            title: derivePlanTitle(plan.spec, plan.bom),
            spec: plan.spec,
            totalAmount: plan.bom?.totalAmount ?? 0,
            totalCount: plan.bom?.totalCount ?? 0,
            createdAt: plan.createdAt,
        };
    }

    /** 发布/取消发布（仅 owner）：发布记 publishedAt=now，取消置 null */
    async publishDiyPlan(ctx: RequestContext, id: string, isPublic: boolean): Promise<DiyPlan> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(id) } });
        if (!plan || plan.userId !== Number(userId)) {
            throw new UserInputError('PLAN_NOT_FOUND_OR_NOT_OWNER');
        }
        plan.isPublic = isPublic;
        plan.publishedAt = isPublic ? new Date() : null;
        return repo.save(plan);
    }

    /** 复制方案（owner 或 isPublic=true 可复制）：复制体归属当前用户、回到 draft、不公开，spec/bom 原样 */
    async copyDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(id) } });
        if (!plan || (plan.userId !== Number(userId) && !plan.isPublic)) {
            throw new UserInputError('PLAN_NOT_ACCESSIBLE');
        }
        return repo.save(
            new DiyPlan({
                app: this.app,
                userId: Number(userId),
                templateId: plan.templateId,
                templateVersion: plan.templateVersion,
                status: 'draft',
                spec: plan.spec,
                bom: plan.bom,
                calcVersion: plan.calcVersion,
                thumb: plan.thumb,
                isPublic: false,
                publishedAt: null,
            }),
        );
    }
}
