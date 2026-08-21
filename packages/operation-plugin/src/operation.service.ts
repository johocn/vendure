import { Injectable } from '@nestjs/common';
import {
    Asset,
    EntityNotFoundError,
    ID,
    Product,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';

import { OperationItem } from './operation-item.entity';
import { OperationSection } from './operation-section.entity';

interface SectionInput {
    code?: string;
    name?: string;
    type?: string;
    displayMode?: string | null;
    enabled?: boolean;
    position?: number;
}

interface ItemInput {
    type: string;
    sortOrder: number;
    title?: string | null;
    imageAssetId?: ID | null;
    linkUrl?: string | null;
    productId?: ID | null;
}

@Injectable()
export class OperationService {
    constructor(private connection: TransactionalConnection) {}

    // ---------- Admin ----------

    /** 全量专区（含 items，按 position 降序）。 */
    async listSections(ctx: RequestContext): Promise<OperationSection[]> {
        const sections = await this.connection.getRepository(ctx, OperationSection).find({
            where: { channelId: ctx.channelId as number } as any,
            relations: { items: true },
            order: { position: 'DESC' } as any,
        });
        this.sortItems(sections);
        return sections;
    }

    async getByCode(ctx: RequestContext, code: string): Promise<OperationSection> {
        const section = await this.connection.getRepository(ctx, OperationSection).findOne({
            where: { code, channelId: ctx.channelId as number } as any,
            relations: { items: true },
        });
        if (!section) {
            throw new EntityNotFoundError('OperationSection', code);
        }
        this.sortItems([section]);
        return section;
    }

    async createSection(ctx: RequestContext, input: SectionInput): Promise<OperationSection> {
        if (!input.code || !input.name || !input.type) {
            throw new Error('OperationSection 缺少必填字段 code/name/type');
        }
        const section = new OperationSection({
            code: input.code,
            name: input.name,
            type: input.type,
            displayMode: input.displayMode ?? null,
            enabled: input.enabled ?? true,
            position: input.position ?? 0,
            channelId: ctx.channelId as number,
        } as any);
        await this.connection.getRepository(ctx, OperationSection).save(section);
        return this.getByCode(ctx, section.code);
    }

    async updateSection(
        ctx: RequestContext,
        id: ID,
        input: Exclude<SectionInput, 'code'>,
    ): Promise<OperationSection> {
        const section = await this.requireSection(ctx, id);
        if (input.name !== undefined) section.name = input.name;
        if (input.type !== undefined) section.type = input.type;
        if (input.displayMode !== undefined) section.displayMode = input.displayMode;
        if (input.enabled !== undefined) section.enabled = input.enabled;
        if (input.position !== undefined) section.position = input.position;
        await this.connection.getRepository(ctx, OperationSection).save(section);
        return this.getByCode(ctx, section.code);
    }

    async deleteSection(ctx: RequestContext, id: ID): Promise<boolean> {
        const section = await this.requireSection(ctx, id);
        // 先删条目，避免 FK 约束（ManyToOne sectionId）
        await this.connection
            .getRepository(ctx, OperationItem)
            .remove(await this.connection.getRepository(ctx, OperationItem).find({
                where: { sectionId: Number(id) } as any,
            }));
        await this.connection.getRepository(ctx, OperationSection).remove(section);
        return true;
    }

    /** 整段替换条目：删除该专区旧条目后按输入全量重建（幂等，按 sortOrder 有序）。 */
    async setOperationItems(ctx: RequestContext, sectionId: ID, items: ItemInput[]): Promise<OperationItem[]> {
        const section = await this.requireSection(ctx, sectionId);
        const repo = this.connection.getRepository(ctx, OperationItem);
        const old = await repo.find({ where: { sectionId: Number(sectionId) } as any });
        if (old.length > 0) {
            await repo.remove(old);
        }
        const saved: OperationItem[] = [];
        for (const it of items) {
            const item = new OperationItem({
                section,
                sectionId: Number(sectionId),
                type: it.type,
                sortOrder: it.sortOrder ?? 0,
                title: it.title ?? null,
                imageAssetId: it.imageAssetId != null ? Number(it.imageAssetId) : null,
                linkUrl: it.linkUrl ?? null,
                productId: it.productId != null ? Number(it.productId) : null,
                channelId: ctx.channelId as number,
            } as any);
            saved.push(await repo.save(item));
        }
        return saved.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /** 校验专区存在（按 id + channel 过滤）。 */
    private async requireSection(ctx: RequestContext, id: ID): Promise<OperationSection> {
        const section = await this.connection.getRepository(ctx, OperationSection).findOne({
            where: { id: Number(id), channelId: ctx.channelId as number } as any,
            relations: { items: true },
        });
        if (!section) {
            throw new EntityNotFoundError('OperationSection', id);
        }
        return section;
    }

    // ---------- Shop ----------

    /** 仅已启用专区，按 position 降序；items 按 sortOrder 升序。 */
    async listEnabled(ctx: RequestContext): Promise<OperationSection[]> {
        const sections = await this.connection.getRepository(ctx, OperationSection).find({
            where: { channelId: ctx.channelId as number, enabled: true } as any,
            relations: { items: true },
            order: { position: 'DESC' } as any,
        });
        this.sortItems(sections);
        return sections;
    }

    /** 按 code 取单个已启用专区；未启用返回 null。 */
    async getEnabledByCode(ctx: RequestContext, code: string): Promise<OperationSection | null> {
        const section = await this.connection.getRepository(ctx, OperationSection).findOne({
            where: { code, channelId: ctx.channelId as number, enabled: true } as any,
            relations: { items: true },
        });
        if (!section) {
            return null;
        }
        this.sortItems([section]);
        return section;
    }

    /** 批量解析条目目标（product / imageUrl），一次查询防 N+1；结果挂在条目实体上供 ResolveField 读取。 */
    async resolveTargets(ctx: RequestContext, sections: OperationSection[]): Promise<void> {
        const items: OperationItem[] = [];
        for (const s of sections) {
            for (const it of s.items ?? []) {
                items.push(it);
            }
        }
        if (items.length === 0) {
            return;
        }

        const productIds = [...new Set(items.filter(i => i.productId != null).map(i => Number(i.productId)))];
        if (productIds.length > 0) {
            const products = await this.connection.getRepository(ctx, Product).find({
                where: { id: In(productIds) } as any,
            });
            const map = new Map<number, Product>(products.map(p => [(p.id as number), p]));
            for (const it of items) {
                if (it.productId != null) {
                    (it as any).__product = map.get(Number(it.productId)) ?? null;
                }
            }
        }

        const assetIds = [...new Set(items.filter(i => i.imageAssetId != null).map(i => Number(i.imageAssetId)))];
        if (assetIds.length > 0) {
            const assets = await this.connection.getRepository(ctx, Asset).find({
                where: { id: In(assetIds) } as any,
            });
            const map = new Map<number, Asset>(assets.map(a => [(a.id as number), a]));
            for (const it of items) {
                if (it.imageAssetId != null) {
                    const asset = map.get(Number(it.imageAssetId));
                    (it as any).__imageUrl = asset ? asset.preview : null;
                }
            }
        }
    }

    private sortItems(sections: OperationSection[]): void {
        for (const s of sections) {
            s.items = (s.items ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        }
    }
}