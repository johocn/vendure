import { Inject, Injectable } from '@nestjs/common';
import {
    JobQueue,
    JobQueueService,
    LanguageCode,
    Logger,
    Product,
    TransactionalConnection,
} from '@vendure/core';
import { EntityManager } from 'typeorm';

import { loggerCtx, MEILI_PLUGIN_OPTIONS } from './constants';
import { MeiliService } from './meili.service';
import { productDocId, ProductProjection, toProductDocuments } from './product-document.mapper';
import { KbDocument, MeiliPluginOptions } from './types';

export interface MeiliReindexJobData {
    productId?: string;
    all?: boolean;
}

const REINDEX_QUEUE_NAME = 'meili-reindex-products';
const PRODUCT_CHUNK_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;

@Injectable()
export class ProductSyncService {
    private queue: JobQueue<MeiliReindexJobData> | undefined;

    constructor(
        @Inject(MEILI_PLUGIN_OPTIONS) private opts: MeiliPluginOptions,
        private meili: MeiliService,
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
    ) {}

    /** 照 order-timeout-plugin 模式：由 plugin.onApplicationBootstrap 调用 */
    async initQueue(): Promise<void> {
        this.queue = await this.jobQueueService.createQueue({
            name: REINDEX_QUEUE_NAME,
            process: async ({ data, id }) => {
                if (data.productId) {
                    await this.syncOne(data.productId);
                } else {
                    await this.syncAll();
                }
                Logger.info(`Meili product reindex job ${id} done`, loggerCtx);
            },
        });
    }

    /** 单品或全量入队；Meili 不可用导致的 job 失败由 retries 兜底重试 */
    async enqueue(productIds?: string[]): Promise<void> {
        if (!this.queue) {
            Logger.warn(`Queue ${REINDEX_QUEUE_NAME} not ready, reindex request dropped`, loggerCtx);
            return;
        }
        if (productIds?.length) {
            for (const productId of productIds) {
                await this.queue.add({ productId: String(productId) }, { retries: 5 });
            }
            return;
        }
        await this.queue.add({ all: true }, { retries: 5 });
    }

    async syncAll(): Promise<void> {
        await this.projectAll(this.connection.rawConnection.manager, [...this.opts.locales], this.urlBase());
    }

    /** 商品主图绝对地址前缀（Vendure 资产服务公网域名）；未配置则文档省略 thumbnail */
    private assetBase(): string {
        return (process.env.PUBLIC_ASSET_URL ?? '').replace(/\/+$/, '');
    }

    /**
     * 全量投影：分块查 Product（防大表）→ 组装投影 → toProductDocuments → 按 locale 500 条/批 upsert
     */
    async projectAll(
        em: EntityManager,
        locales: string[],
        urlBase: string,
    ): Promise<Map<string, KbDocument[]>> {
        const docsByLocale = new Map<string, KbDocument[]>(locales.map(locale => [locale, []]));
        const repo = em.getRepository(Product);
        let skip = 0;
        for (;;) {
            const products = await repo.find({
                relations: {
                    translations: true,
                    variants: { productVariantPrices: true, collections: true },
                    channels: true,
                    featuredAsset: true,
                },
                skip,
                take: PRODUCT_CHUNK_SIZE,
                order: { id: 'ASC' },
            });
            if (!products.length) break;
            for (const product of products) {
                // 已软删商品：同步清索引（全量重建是 upsert 语义，残留文档不会自动消失）
                if (product.deletedAt) {
                    await this.removeProduct(String(product.id));
                    continue;
                }
                const projection = this.toProjection(product, urlBase);
                // toProductDocuments 按 locales 顺序产出，zip 回对应 locale 桶
                toProductDocuments(projection, locales).forEach((doc, i) => {
                    docsByLocale.get(locales[i])?.push(doc);
                });
            }
            if (products.length < PRODUCT_CHUNK_SIZE) break;
            skip += PRODUCT_CHUNK_SIZE;
        }
        for (const [locale, docs] of docsByLocale) {
            await this.upsertInBatches(locale, docs);
        }
        Logger.info(
            `Meili projectAll done: ${[...docsByLocale.entries()]
                .map(([locale, docs]) => `${locale}=${docs.length}`)
                .join(', ')}`,
            loggerCtx,
        );
        return docsByLocale;
    }

    /**
     * 单品同步：published → 各语言索引 upsert；draft/disabled → deleteDocuments；
     * 产品已不存在时也做删除（变体/商品删除事件兜底清理）
     */
    async syncOne(productId: string): Promise<void> {
        const product = await this.connection.rawConnection.manager.getRepository(Product).findOne({
            where: { id: productId },
            relations: {
                translations: true,
                variants: { productVariantPrices: true, collections: true },
                channels: true,
                featuredAsset: true,
            },
        });
        if (!product || product.deletedAt) {
            Logger.warn(`Meili syncOne: product ${productId} ${product ? 'soft-deleted' : 'not found'}, removing docs`, loggerCtx);
            await this.removeProduct(String(productId));
            return;
        }
        const projection = this.toProjection(product, this.urlBase());
        const docs = toProductDocuments(projection, this.opts.locales);
        if (docs.length) {
            for (let i = 0; i < docs.length; i++) {
                await this.meili.upsertDocuments(this.opts.locales[i], [docs[i]]);
            }
        } else {
            await this.removeProduct(String(productId));
        }
    }

    /** 从所有语言索引删除该商品文档（ProductEvent deleted 直连清理入口） */
    async removeProduct(productId: string): Promise<void> {
        for (const locale of this.opts.locales) {
            await this.meili.deleteDocuments(locale, [productDocId(productId)]);
        }
    }

    private urlBase(): string {
        return process.env.PUBLIC_STOREFRONT_URL ?? '';
    }

    private async upsertInBatches(locale: string, docs: KbDocument[]): Promise<void> {
        for (let i = 0; i < docs.length; i += UPSERT_BATCH_SIZE) {
            await this.meili.upsertDocuments(locale, docs.slice(i, i + UPSERT_BATCH_SIZE));
        }
    }

    private toProjection(product: Product, urlBase: string): ProductProjection {
        const zh = product.translations?.find(t => t.languageCode === LanguageCode.zh_Hans);
        const en = product.translations?.find(t => t.languageCode === LanguageCode.en);
        const channelIds = this.resolveChannelIds(product);
        // 价格口径沿用既有规则：优先非默认渠道，全无则默认渠道
        const priceChannelId = channelIds.find(id => id !== '1') ?? channelIds[0];
        const assetBase = this.assetBase();
        const preview = product.featuredAsset?.preview ?? '';
        const thumbnailUrl = assetBase && preview ? `${assetBase}/${preview.replace(/^\/+/, '')}` : '';
        return {
            productId: String(product.id),
            channelId: priceChannelId,
            channelIds,
            status: product.enabled && !product.deletedAt ? 'published' : 'draft',
            updatedAt: product.updatedAt ? new Date(product.updatedAt).getTime() : Date.now(),
            nameZh: zh?.name ?? '',
            nameEn: en?.name ?? '',
            descZh: zh?.description ?? '',
            descEn: en?.description ?? '',
            slugZh: zh?.slug ?? '',
            slugEn: en?.slug ?? '',
            price: this.resolvePrice(product, priceChannelId),
            collectionIds: [
                ...new Set(
                    (product.variants ?? []).flatMap(v => (v.collections ?? []).map(c => String(c.id))),
                ),
            ],
            tags: [],
            urlBase,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
        };
    }

    /**
     * 商品所属全部渠道（数值升序去重）；无关联时回退默认渠道 '1'。
     * 商品常同时挂在默认渠道与多个租户渠道，只存单一渠道会导致其它渠道搜不到。
     */
    private resolveChannelIds(product: Product): string[] {
        const ids = [...new Set((product.channels ?? []).map(c => String(c.id)))];
        return ids.length ? ids.sort((a, b) => Number(a) - Number(b)) : ['1'];
    }

    /**
     * 取价照 vcash-pos-plugin 口径：ProductVariant.price 是 @Calculated 字段（依赖运行时 listPrice），
     * 原始查询下恒为 0，须读 productVariantPrices 关联按渠道匹配取真实价格。
     */
    private resolvePrice(product: Product, channelId: string): number {
        const prices = (product.variants ?? [])
            .map(
                v =>
                    v.productVariantPrices?.find(p => Number(p.channelId) === Number(channelId))?.price ??
                    0,
            )
            .filter(p => p > 0);
        return prices.length ? Math.min(...prices) : 0;
    }
}
