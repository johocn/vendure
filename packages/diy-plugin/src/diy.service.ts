import { Inject, Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { FindOptionsWhere } from 'typeorm';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import {
    DiyCategoryInput,
    DiyMaterialInput,
    DiyPluginOptions,
    DiyTemplateConfig,
    DiyTemplateInput,
    LocalizedText,
} from './types';

@Injectable()
export class DiyService {
    constructor(
        private connection: TransactionalConnection,
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
    ) {}

    /* ------------------------------ 分类 ------------------------------ */

    /** app 传 undefined = 全部（管理端），传 null = 仅平台 */
    async findCategories(ctx: RequestContext, app?: string | null): Promise<DiyCategory[]> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const qb = repo.createQueryBuilder('cat');
        if (app !== undefined) {
            qb.where('cat.app = :app', { app });
        }
        return qb.orderBy('cat.sortOrder', 'ASC').addOrderBy('cat.id', 'ASC').getMany();
    }

    async findOneCategory(ctx: RequestContext, id: ID): Promise<DiyCategory | null> {
        return this.connection.getRepository(ctx, DiyCategory).findOne({ where: { id: id as any } });
    }

    async createCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        if (input.code) {
            const dup = await repo.findOne({ where: { app: (input.app ?? null) as any, code: input.code } });
            if (dup) {
                throw new UserInputError(`分类 code 已存在: ${input.code}`);
            }
        }
        const cat = new DiyCategory({
            app: input.app ?? null,
            code: input.code ?? null,
            parentId: input.parentId ?? null,
            name: (input.name ?? {}) as LocalizedText,
            image: input.image ?? null,
            sortOrder: input.sortOrder ?? 0,
            enabled: input.enabled ?? true,
        });
        return repo.save(cat);
    }

    async updateCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cat = await repo.findOne({ where: { id: input.id as any } });
        if (!cat) {
            throw new UserInputError('分类不存在');
        }
        if (input.code !== undefined) cat.code = input.code;
        if (input.parentId !== undefined) cat.parentId = input.parentId;
        if (input.name !== undefined) cat.name = input.name as LocalizedText;
        if (input.image !== undefined) cat.image = input.image;
        if (input.sortOrder !== undefined) cat.sortOrder = input.sortOrder;
        if (input.enabled !== undefined) cat.enabled = input.enabled;
        return repo.save(cat);
    }

    async deleteCategory(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cat = await repo.findOne({ where: { id: id as any } });
        if (!cat) {
            return false;
        }
        const used = await this.connection
            .getRepository(ctx, DiyMaterial)
            .count({ where: { categoryId: Number(id) as any } });
        if (used > 0) {
            throw new UserInputError(`分类下存在 ${used} 个素材，禁止删除`);
        }
        await repo.remove(cat);
        return true;
    }

    /* ------------------------------ 素材 ------------------------------ */

    async findMaterials(
        ctx: RequestContext,
        app?: string | null,
        skip = 0,
        take = 100,
    ): Promise<DiyMaterial[]> {
        const qb = this.connection
            .getRepository(ctx, DiyMaterial)
            .createQueryBuilder('mat')
            .skip(skip)
            .take(Math.min(take, 500))
            .orderBy('mat.sortOrder', 'ASC')
            .addOrderBy('mat.id', 'ASC');
        if (app !== undefined) {
            qb.where('mat.app = :app', { app });
        }
        return qb.getMany();
    }

    async findOneMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial | null> {
        return this.connection.getRepository(ctx, DiyMaterial).findOne({ where: { id: id as any } });
    }

    /** (app, code) 唯一性服务层校验 */
    private async assertCodeFree(
        ctx: RequestContext,
        app: string | null,
        code: string,
        excludeId?: ID,
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const existing = await repo.findOne({ where: { app: app as any, code } });
        if (existing && (!excludeId || String(existing.id) !== String(excludeId))) {
            throw new UserInputError(`货号已存在: ${code}（app=${app ?? 'platform'}）`);
        }
    }

    async createMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial> {
        if (!input.code || !input.name || input.categoryId == null || !input.shape || input.price == null) {
            throw new UserInputError('code/name/categoryId/shape/price 为必填');
        }
        const app = input.app ?? null;
        await this.assertCodeFree(ctx, app, input.code);
        const mat = new DiyMaterial({
            app,
            code: input.code,
            name: input.name as LocalizedText,
            categoryId: input.categoryId,
            shape: input.shape,
            diameter: input.diameter ?? null,
            axialLength: input.axialLength ?? null,
            holeSize: input.holeSize ?? null,
            attrs: input.attrs ?? null,
            render: input.render ?? null,
            price: Math.round(input.price),
            priceUnit: input.priceUnit ?? 'piece',
            currency: input.currency ?? 'CNY',
            stock: Math.round(input.stock ?? 0),
            images: input.images ?? null,
            enabled: input.enabled ?? true,
            sortOrder: input.sortOrder ?? 0,
        });
        return this.connection.getRepository(ctx, DiyMaterial).save(mat);
    }

    async updateMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const mat = await repo.findOne({ where: { id: input.id as any } });
        if (!mat) {
            throw new UserInputError('素材不存在');
        }
        if (input.code !== undefined && input.code !== mat.code) {
            await this.assertCodeFree(ctx, mat.app, input.code, mat.id);
            mat.code = input.code;
        }
        if (input.name !== undefined) mat.name = input.name as LocalizedText;
        if (input.categoryId !== undefined) mat.categoryId = input.categoryId;
        if (input.shape !== undefined) mat.shape = input.shape;
        if (input.diameter !== undefined) mat.diameter = input.diameter;
        if (input.axialLength !== undefined) mat.axialLength = input.axialLength;
        if (input.holeSize !== undefined) mat.holeSize = input.holeSize;
        if (input.attrs !== undefined) mat.attrs = input.attrs;
        if (input.render !== undefined) mat.render = input.render;
        if (input.price !== undefined) mat.price = Math.round(input.price);
        if (input.priceUnit !== undefined) mat.priceUnit = input.priceUnit;
        if (input.currency !== undefined) mat.currency = input.currency;
        if (input.stock !== undefined) mat.stock = Math.round(input.stock);
        if (input.images !== undefined) mat.images = input.images;
        if (input.enabled !== undefined) mat.enabled = input.enabled;
        if (input.sortOrder !== undefined) mat.sortOrder = input.sortOrder;
        return repo.save(mat);
    }

    async deleteMaterial(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const mat = await repo.findOne({ where: { id: id as any } });
        if (!mat) {
            return false;
        }
        await repo.remove(mat);
        return true;
    }

    /** 租户复制平台素材 = 完全接管价库存（sourceMaterialId 回链） */
    async copyMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const source = await repo.findOne({ where: { id: id as any } });
        if (!source) {
            throw new UserInputError('素材不存在');
        }
        if (source.app !== null) {
            throw new UserInputError('仅平台素材可复制为租户素材');
        }
        const tenantApp = this.options.app ?? 'nshop';
        await this.assertCodeFree(ctx, tenantApp, source.code);
        const copy = new DiyMaterial({
            ...source,
            id: undefined,
            app: tenantApp,
            sourceMaterialId: Number(source.id),
        } as Partial<DiyMaterial>);
        return repo.save(copy);
    }

    /**
     * 批量导入/更新素材（首批珠子库 40+ 条走这里）。
     * input = { app?: string | null, items: DiyMaterialInput[] }；按 (app, code) upsert。
     * 返回处理条数。
     */
    async importMaterials(ctx: RequestContext, input: { app?: string | null; items: DiyMaterialInput[] }): Promise<number> {
        if (!Array.isArray(input.items) || input.items.length === 0) {
            throw new UserInputError('items 不能为空');
        }
        const app = input.app ?? null;
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        return this.connection.withTransaction(ctx, async txCtx => {
            const txRepo = this.connection.getRepository(txCtx, DiyMaterial);
            let count = 0;
            for (const item of input.items) {
                if (!item.code) {
                    throw new UserInputError('导入项缺少 code');
                }
                const existing = await txRepo.findOne({ where: { app: app as any, code: item.code } });
                if (existing) {
                    if (item.name !== undefined) existing.name = item.name as LocalizedText;
                    if (item.categoryId !== undefined) existing.categoryId = item.categoryId;
                    if (item.shape !== undefined) existing.shape = item.shape;
                    if (item.diameter !== undefined) existing.diameter = item.diameter;
                    if (item.axialLength !== undefined) existing.axialLength = item.axialLength;
                    if (item.holeSize !== undefined) existing.holeSize = item.holeSize;
                    if (item.attrs !== undefined) existing.attrs = item.attrs;
                    if (item.render !== undefined) existing.render = item.render;
                    if (item.price !== undefined) existing.price = Math.round(item.price);
                    if (item.priceUnit !== undefined) existing.priceUnit = item.priceUnit;
                    if (item.currency !== undefined) existing.currency = item.currency;
                    if (item.stock !== undefined) existing.stock = Math.round(item.stock);
                    if (item.images !== undefined) existing.images = item.images;
                    if (item.enabled !== undefined) existing.enabled = item.enabled;
                    if (item.sortOrder !== undefined) existing.sortOrder = item.sortOrder;
                    await txRepo.save(existing);
                } else {
                    if (item.categoryId == null || !item.shape || item.price == null) {
                        throw new UserInputError(`新货号 ${item.code} 缺少 categoryId/shape/price`);
                    }
                    await txRepo.save(
                        new DiyMaterial({
                            app,
                            code: item.code,
                            name: (item.name ?? item.code) as LocalizedText,
                            categoryId: item.categoryId,
                            shape: item.shape,
                            diameter: item.diameter ?? null,
                            axialLength: item.axialLength ?? null,
                            holeSize: item.holeSize ?? null,
                            attrs: item.attrs ?? null,
                            render: item.render ?? null,
                            price: Math.round(item.price),
                            priceUnit: item.priceUnit ?? 'piece',
                            currency: item.currency ?? 'CNY',
                            stock: Math.round(item.stock ?? 0),
                            images: item.images ?? null,
                            enabled: item.enabled ?? true,
                            sortOrder: item.sortOrder ?? 0,
                        }),
                    );
                }
                count++;
            }
            Logger.info(`importMaterials app=${app ?? 'platform'} count=${count}`, loggerCtx);
            return count;
        });
    }

    /* ------------------------------ 模板 ------------------------------ */

    async findTemplates(ctx: RequestContext, app?: string | null): Promise<DiyTemplate[]> {
        const qb = this.connection
            .getRepository(ctx, DiyTemplate)
            .createQueryBuilder('tpl')
            .orderBy('tpl.sortOrder', 'ASC')
            .addOrderBy('tpl.id', 'ASC');
        if (app !== undefined) {
            qb.where('tpl.app = :app', { app });
        }
        return qb.getMany();
    }

    async findOneTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate | null> {
        return this.connection.getRepository(ctx, DiyTemplate).findOne({ where: { id: id as any } });
    }

    async createTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate> {
        if (!input.code || !input.name || !input.config) {
            throw new UserInputError('code/name/config 为必填');
        }
        const app = input.app ?? null;
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const dup = await repo.findOne({ where: { app: app as any, code: input.code } });
        if (dup) {
            throw new UserInputError(`模板 code 已存在: ${input.code}（app=${app ?? 'platform'}）`);
        }
        const config = input.config;
        return repo.save(
            new DiyTemplate({
                app,
                code: input.code,
                name: input.name as LocalizedText,
                description: input.description ?? null,
                thumb: input.thumb ?? null,
                images: input.images ?? null,
                config,
                calculatorKey: input.calculatorKey ?? null,
                status: input.status ?? 'draft',
                sortOrder: input.sortOrder ?? 0,
            }),
        );
    }

    async updateTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: input.id as any } });
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        if (input.code !== undefined) tpl.code = input.code;
        if (input.name !== undefined) tpl.name = input.name as LocalizedText;
        if (input.description !== undefined) tpl.description = input.description;
        if (input.thumb !== undefined) tpl.thumb = input.thumb;
        if (input.images !== undefined) tpl.images = input.images;
        if (input.config !== undefined) tpl.config = input.config as DiyTemplateConfig;
        if (input.calculatorKey !== undefined) tpl.calculatorKey = input.calculatorKey;
        if (input.status !== undefined) tpl.status = input.status;
        if (input.sortOrder !== undefined) tpl.sortOrder = input.sortOrder;
        return repo.save(tpl);
    }

    async deleteTemplate(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) {
            return false;
        }
        await repo.remove(tpl);
        return true;
    }

    /** 发布：status → enabled 且 version+1（规格 §5.1） */
    async publishTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        tpl.status = 'enabled';
        tpl.version = (tpl.version ?? 1) + 1;
        return repo.save(tpl);
    }

    /** 租户复制平台模板改配置（同素材库哲学） */
    async copyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const source = await repo.findOne({ where: { id: id as any } });
        if (!source) {
            throw new UserInputError('模板不存在');
        }
        if (source.app !== null) {
            throw new UserInputError('仅平台模板可复制为租户模板');
        }
        const tenantApp = this.options.app ?? 'nshop';
        const dup = await repo.findOne({ where: { app: tenantApp, code: source.code } });
        if (dup) {
            throw new UserInputError(`租户模板 code 已存在: ${source.code}`);
        }
        return repo.save(
            new DiyTemplate({
                ...source,
                id: undefined,
                app: tenantApp,
            } as Partial<DiyTemplate>),
        );
    }

    /* ------------------------------ 方案 ------------------------------ */

    /** admin 方案列表（规格 §7 admin 面）；app 不传 = 全部租户端 */
    async findPlans(
        ctx: RequestContext,
        options: { app?: string; status?: string; skip?: number; take?: number } = {},
    ): Promise<{ items: DiyPlan[]; total: number }> {
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const where: FindOptionsWhere<DiyPlan> = {};
        if (options.app !== undefined) {
            where.app = options.app;
        }
        if (options.status) {
            where.status = options.status as 'draft' | 'quoted' | 'ordered';
        }
        const [items, total] = await repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: options.skip ?? 0,
            take: options.take ?? 50,
        });
        return { items, total };
    }
}
