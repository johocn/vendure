import { Injectable } from '@nestjs/common';
import {
    assertFound,
    ChannelService,
    Collection,
    CollectionService,
    ID,
    idsAreEqual,
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
            relations: ['channels'],
        } as any);
        if (!collection) return;
        const filters: any[] = (collection as any).filters ?? [];
        const productIdFilter = filters.find((f: any) => f.code === 'product-id-filter');
        if (productIdFilter) {
            const arg = productIdFilter.arguments?.find((a: any) => a.name === 'productIds');
            const existing: string[] = arg ? (JSON.parse(arg.value || '[]') as string[]) : [];
            if (!existing.includes(String(productId))) {
                const target: any = arg ?? { name: 'productIds', value: '[]' };
                target.value = JSON.stringify([...existing, String(productId)]);
                if (!productIdFilter.arguments) {
                    productIdFilter.arguments = [target];
                } else if (!productIdFilter.arguments.includes(target)) {
                    productIdFilter.arguments.push(target);
                }
            }
        } else {
            filters.push({
                code: 'product-id-filter',
                arguments: [
                    { name: 'productIds', value: JSON.stringify([String(productId)]) },
                    { name: 'combineWithAnd', value: 'false' },
                ],
            });
        }
        collection.filters = filters;
        await repo.save(collection);
    }
}