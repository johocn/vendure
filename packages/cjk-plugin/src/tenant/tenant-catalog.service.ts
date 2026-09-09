import { Injectable } from '@nestjs/common';
import {
    assertFound,
    ChannelService,
    Collection,
    CollectionService,
    ID,
    idsAreEqual,
    InternalServerError,
    Product,
    RequestContext,
    TransactionalConnection,
    Translated,
} from '@vendure/core';
import { CreateCollectionInput } from '@vendure/common/lib/generated-types';

@Injectable()
export class TenantCatalogService {
    constructor(
        private collectionService: CollectionService,
        private channelService: ChannelService,
        private connection: TransactionalConnection,
    ) {}

    /** 解析 productIds 参数值：Vendure ConfigArg 中 list 型参数以 JSON 字符串存储（如 '[60]' / '["60"]'），兼容数组。 */
    private parseIdList(value: unknown): ID[] {
        if (Array.isArray(value)) return value.map(String);
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.map(String) : [];
            } catch {
                return value ? [value] : [];
            }
        }
        return [];
    }

    /**
     * 创建租户分类后，主动从默认渠道摘除，实现「租户分类只挂租户渠道、进默认商城」双轨隔离。
     * 不能走 removeCollectionsFromChannel（会对默认渠道抛错），须直接 channelService.removeFromChannels。
     */
    async createTenantCollection(
        ctx: RequestContext,
        input: CreateCollectionInput,
    ): Promise<Translated<Collection>> {
        const collection = await this.collectionService.create(ctx, input);
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        if (!idsAreEqual(defaultChannel.id, ctx.channelId)) {
            await this.channelService.removeFromChannels(ctx, Collection, collection.id, [
                defaultChannel.id,
            ]);
        }
        return assertFound(this.collectionService.findOne(ctx, collection.id));
    }

    /** 把商品 ID 追加进平台分类的 productId 过滤器（只增；非 productId 独过滤器则新建一条 productId 过滤器，不改其它过滤器）。 */
    async addProductToCollection(ctx: RequestContext, productId: ID, collectionId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, Collection);
        const collection = await repo.findOne({
            where: { id: String(collectionId) },
        } as any);
        if (!collection) return;
        // Vendure ConfigurableOperation 标准形态：{ code, args: [{name, value}] }，list 参数值存 JSON 字符串。
        const filters: Array<{ code: string; args: Array<{ name: string; value: unknown }> }> =
            collection.filters ?? [];
        const productIdFilter = filters.find(f => f.code === 'product-id-filter');
        if (productIdFilter) {
            const idsArg = productIdFilter.args?.find(a => a.name === 'productIds');
            const existing = this.parseIdList(idsArg?.value);
            if (!existing.includes(String(productId))) {
                const newValue = JSON.stringify([...existing, String(productId)]);
                if (idsArg) {
                    idsArg.value = newValue;
                } else {
                    (productIdFilter.args = productIdFilter.args ?? []).push({
                        name: 'productIds',
                        value: newValue,
                    });
                }
            }
        } else {
            filters.push({
                code: 'product-id-filter',
                args: [
                    { name: 'productIds', value: JSON.stringify([String(productId)]) },
                    { name: 'combineWithAnd', value: 'false' },
                ],
            });
        }
        // 用 repo.update 显式只更新 filters 列（无条件发 UPDATE，绕开 TypeORM save() 对 simple-json 的引用级脏检测，确保真正持久化）。
        await repo.update(collection.id, { filters } as any);
        // 重新计算该分类的变体成员，使商品立即出现在分类列表页（等价 updateCollection 的 applyCollectionFilters）。
        await this.collectionService.triggerApplyFiltersJob(ctx, {
            collectionIds: [collection.id],
        });
    }

    /**
     * 把商品挂到租户渠道并从默认渠道摘除（双轨隔离）。
     * 不能走 removeProductsFromChannel（会被「默认渠道不可摘除」守卫拦），须直接 channelService.removeFromChannels。
     */
    async moveProductsToTenantChannel(
        ctx: RequestContext,
        productIds: ID[],
        channelId: ID,
    ): Promise<Product[]> {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel) throw new InternalServerError(`Channel not found: ${channelId}`);
        const result: Product[] = [];
        for (const id of productIds) {
            if (!idsAreEqual(channel.id, defaultChannel.id)) {
                await this.channelService.assignToChannels(ctx, Product, id, [channel.id]);
            }
            await this.channelService.removeFromChannels(ctx, Product, id, [defaultChannel.id]);
            const p = await this.connection
                .getRepository(ctx, Product)
                .findOne({ where: { id: String(id) } } as any);
            if (p) result.push(p);
        }
        return result;
    }
}