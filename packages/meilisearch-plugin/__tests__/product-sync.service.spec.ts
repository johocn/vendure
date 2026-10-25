import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityManager } from 'typeorm';

import { MeiliService } from '../src/meili.service';
import { MeiliReindexJobData, ProductSyncService } from '../src/product-sync.service';
import { MeiliPluginOptions } from '../src/types';

const options: MeiliPluginOptions = {
    host: 'http://127.0.0.1:7700',
    adminKey: 'test-admin-key',
    indexPrefix: 'kb',
    locales: ['zh', 'en'],
};

function makeProduct(overrides: Record<string, unknown> = {}) {
    return {
        id: 42,
        enabled: true,
        updatedAt: new Date('2026-01-02T03:04:05Z'),
        translations: [
            { languageCode: 'zh_Hans', name: '温泉门票', description: '节假日通用', slug: 'hot-spring' },
            { languageCode: 'en', name: 'Hot Spring', description: 'Valid on holidays', slug: 'hot-spring' },
        ],
        variants: [
            {
                productVariantPrices: [{ channelId: 1, price: 100 }, { channelId: 37, price: 9900 }],
                collections: [{ id: 7 }, { id: 8 }],
            },
            { productVariantPrices: [{ channelId: 37, price: 5800 }], collections: [{ id: 8 }] },
        ],
        channels: [
            { id: 1, code: '__default_channel__' },
            { id: 37, code: 'tenant-a' },
        ],
        ...overrides,
    };
}

type FindOne = (opts: unknown) => Promise<unknown>;
type Find = (opts: unknown) => Promise<unknown[]>;

function makeConnection(findOne: FindOne, find?: Find) {
    const manager = {
        getRepository: () => ({
            findOne,
            find: find ?? (async () => []),
        }),
    };
    return { rawConnection: { manager } } as never;
}

function makeService(findOne: FindOne, find?: Find) {
    const meili = {
        upsertDocuments: vi.fn(async (..._args: unknown[]) => undefined),
        deleteDocuments: vi.fn(async (..._args: unknown[]) => undefined),
    };
    const jobQueueService = {
        createQueue: vi.fn(async (..._args: unknown[]) => ({ add: vi.fn(async (..._a: unknown[]) => undefined) })),
    };
    const service = new ProductSyncService(
        options,
        meili as unknown as MeiliService,
        jobQueueService as never,
        makeConnection(findOne, find),
    );
    return { service, meili, jobQueueService };
}

describe('ProductSyncService', () => {
    beforeEach(() => {
        process.env.PUBLIC_STOREFRONT_URL = 'https://shop.example.com';
    });

    afterEach(() => {
        delete process.env.PUBLIC_STOREFRONT_URL;
    });

    it('syncOne: published 商品按 locale upsert，渠道与价格照仓库口径取值', async () => {
        const { service, meili } = makeService(async () => makeProduct());

        await service.syncOne('42');

        expect(meili.deleteDocuments).not.toHaveBeenCalled();
        expect(meili.upsertDocuments).toHaveBeenCalledTimes(2);
        const [zhLocale, zhDocs] = meili.upsertDocuments.mock.calls[0];
        const [enLocale, enDocs] = meili.upsertDocuments.mock.calls[1];
        expect(zhLocale).toBe('zh');
        expect(enLocale).toBe('en');
        const zhDoc = (zhDocs as unknown[])[0];
        const enDoc = (enDocs as unknown[])[0];
        expect(zhDoc).toMatchObject({
            id: 'product-42',
            type: 'product',
            channelId: '37',
            channelIds: ['1', '37'], // 全部所属渠道，供各渠道检索命中共用商品
            status: 'published',
            title: '温泉门票',
            price: 5800, // 两变体在该渠道价格的最低价
            collectionIds: ['7', '8'], // 变体关联 collection 去重
            url: 'https://shop.example.com/hot-spring',
        });
        expect(enDoc).toMatchObject({ title: 'Hot Spring', url: 'https://shop.example.com/hot-spring' });
    });

    it('syncOne: draft（enabled=false）走删除分支，不 upsert', async () => {
        const { service, meili } = makeService(async () => makeProduct({ enabled: false }));

        await service.syncOne('42');

        expect(meili.upsertDocuments).not.toHaveBeenCalled();
        expect(meili.deleteDocuments).toHaveBeenCalledTimes(2);
        expect(meili.deleteDocuments).toHaveBeenCalledWith('zh', ['product-42']);
        expect(meili.deleteDocuments).toHaveBeenCalledWith('en', ['product-42']);
    });

    it('syncOne: 商品已不存在时清理各语言索引文档', async () => {
        const { service, meili } = makeService(async () => undefined);

        await service.syncOne('42');

        expect(meili.upsertDocuments).not.toHaveBeenCalled();
        expect(meili.deleteDocuments).toHaveBeenCalledWith('zh', ['product-42']);
        expect(meili.deleteDocuments).toHaveBeenCalledWith('en', ['product-42']);
    });

    it('syncOne: 仅有默认渠道时 channelIds/channelId 均为 1', async () => {
        const { service, meili } = makeService(async () =>
            makeProduct({
                channels: [{ id: 1, code: '__default_channel__' }],
                variants: [{ productVariantPrices: [{ channelId: 1, price: 6600 }] }],
            }),
        );

        await service.syncOne('42');

        expect((meili.upsertDocuments.mock.calls[0][1] as unknown[])[0]).toMatchObject({
            channelId: '1',
            channelIds: ['1'],
            price: 6600,
        });
    });

    it('projectAll: 分块查全量并按 locale upsert，draft 不产出文档', async () => {
        const batch = [
            makeProduct(),
            makeProduct({ id: 43, enabled: false }), // draft 不产出文档
            makeProduct({
                id: 44,
                translations: [{ languageCode: 'zh_Hans', name: '其他', description: '', slug: 'other' }],
            }),
        ];
        let call = 0;
        const find: Find = async () => (call++ === 0 ? batch : []);
        const { service, meili } = makeService(async () => undefined, find);
        const em = { getRepository: () => ({ find }) } as unknown as EntityManager;

        const result = await service.projectAll(em, ['zh', 'en'], 'https://shop.example.com');

        expect(result.get('zh')).toHaveLength(2);
        expect(result.get('en')).toHaveLength(2); // en 缺失翻译时回退 zh
        expect(meili.upsertDocuments).toHaveBeenCalledTimes(2);
        expect(meili.upsertDocuments).toHaveBeenCalledWith(
            'zh',
            expect.arrayContaining([expect.objectContaining({ id: 'product-42' })]),
        );
        expect(meili.upsertDocuments).toHaveBeenCalledWith(
            'en',
            expect.arrayContaining([expect.objectContaining({ id: 'product-44', title: '其他' })]),
        );
    });

    it('initQueue + enqueue: 单品逐条入队（retries 5），无参则全量入队', async () => {
        const { service, jobQueueService } = makeService(async () => undefined);
        await service.initQueue();

        expect(jobQueueService.createQueue).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'meili-reindex-products' }),
        );
        const queue = (await jobQueueService.createQueue.mock.results[0].value) as {
            add: ReturnType<typeof vi.fn>;
        };

        await service.enqueue(['42', '43']);
        await service.enqueue();

        expect(queue.add).toHaveBeenNthCalledWith(1, { productId: '42' }, { retries: 5 });
        expect(queue.add).toHaveBeenNthCalledWith(2, { productId: '43' }, { retries: 5 });
        expect(queue.add).toHaveBeenNthCalledWith(3, { all: true }, { retries: 5 });
    });

    it('队列 process: data.productId 存在走 syncOne，否则 syncAll', async () => {
        const { service, jobQueueService } = makeService(async () => undefined);
        await service.initQueue();
        const createQueueOptions = jobQueueService.createQueue.mock.calls[0][0] as {
            process: (job: { data: MeiliReindexJobData; id: string }) => Promise<void>;
        };
        const syncOne = vi.spyOn(service, 'syncOne').mockResolvedValue(undefined);
        const syncAll = vi.spyOn(service, 'syncAll').mockResolvedValue(undefined);

        await createQueueOptions.process({ data: { productId: '42' }, id: 'job-1' });
        expect(syncOne).toHaveBeenCalledWith('42');

        await createQueueOptions.process({ data: { all: true }, id: 'job-2' });
        expect(syncAll).toHaveBeenCalledTimes(1);
    });
});
