import { Inject, Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';

import { PLUGIN_INIT_OPTIONS } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { mergeMaterials } from './material-merge';
import { DiyMaterialFilter, DiyPluginOptions } from './types';

export interface DiyMaterialList {
    items: DiyMaterial[];
    total: number;
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
}
