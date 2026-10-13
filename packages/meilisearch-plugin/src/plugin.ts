import { Inject, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    PluginCommonModule,
    ProductEvent,
    ProductVariantEvent,
    VendurePlugin,
} from '@vendure/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MeiliAdminResolver } from './admin-api/meili-admin.resolver';
import { loggerCtx, MEILI_PLUGIN_OPTIONS } from './constants';
import { MeiliService } from './meili.service';
import { ProductSyncService } from './product-sync.service';
import { MeiliPluginOptions } from './types';

const { gql } = require('graphql-tag');

/** SDL 独立维护在 admin-api/schema.graphql（构建时随 lib 一并拷贝），此处惰性读取 */
const adminApiSchema = () => gql(readFileSync(join(__dirname, 'admin-api', 'schema.graphql'), 'utf-8'));

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: MEILI_PLUGIN_OPTIONS, useFactory: () => MeiliSearchPlugin.options },
        MeiliService,
        ProductSyncService,
    ],
    exports: [MeiliService],
    adminApiExtensions: {
        schema: adminApiSchema,
        resolvers: [MeiliAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class MeiliSearchPlugin {
    static options: MeiliPluginOptions;

    constructor(
        @Inject(MEILI_PLUGIN_OPTIONS) private options: MeiliPluginOptions,
        private meiliService: MeiliService,
        private productSync: ProductSyncService,
        private eventBus: EventBus,
    ) {}

    static init(options: MeiliPluginOptions): Type<MeiliSearchPlugin> {
        MeiliSearchPlugin.options = options;
        return MeiliSearchPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        try {
            await this.productSync.initQueue();
        } catch (e) {
            Logger.error(`MeiliSearchPlugin queue init failed: ${String(e)}`, loggerCtx);
        }

        this.subscribeEvents();

        try {
            await this.meiliService.ensureIndexes();
            Logger.info('MeiliSearchPlugin initialized', loggerCtx);
        } catch (e) {
            // Meili 不可用不阻塞 Vendure 启动，降级为日志（同步 job 失败靠 retries 重试）
            Logger.error(`MeiliSearchPlugin bootstrap failed: ${String(e)}`, loggerCtx);
        }
    }

    private subscribeEvents(): void {
        // 商品增改 → 入队增量同步；删除 → 直接清理各语言索引文档（删除事件实体可能只剩 id）
        this.eventBus.ofType(ProductEvent).subscribe(event => {
            void this.onProductEvent(event);
        });
        // 变体增改删 → 取 productId 入队（entity 为变体数组；删除事件可能只剩 id，productId 列仍在）
        this.eventBus.ofType(ProductVariantEvent).subscribe(event => {
            void this.onVariantEvent(event);
        });
    }

    private async onProductEvent(event: ProductEvent): Promise<void> {
        try {
            const productId = String(event.entity.id);
            if (event.type === 'deleted') {
                await this.productSync.removeProduct(productId);
            } else {
                await this.productSync.enqueue([productId]);
            }
        } catch (e) {
            Logger.error(`MeiliSearchPlugin ProductEvent(${event.type}) failed: ${String(e)}`, loggerCtx);
        }
    }

    private async onVariantEvent(event: ProductVariantEvent): Promise<void> {
        try {
            const productIds = [
                ...new Set(
                    (event.entity ?? [])
                        .map(v => v?.productId ?? v?.product?.id)
                        .filter((id): id is NonNullable<typeof id> => id != null)
                        .map(id => String(id)),
                ),
            ];
            if (!productIds.length) return;
            for (const productId of productIds) {
                await this.productSync.enqueue([productId]);
            }
        } catch (e) {
            Logger.error(`MeiliSearchPlugin ProductVariantEvent(${event.type}) failed: ${String(e)}`, loggerCtx);
        }
    }
}
