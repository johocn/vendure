import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeiliService } from '../src/meili.service';
import { KbDocument, MeiliPluginOptions } from '../src/types';

const options: MeiliPluginOptions = {
    host: 'http://127.0.0.1:7700',
    adminKey: 'test-admin-key',
    indexPrefix: 'kb',
    locales: ['zh', 'en'],
};

interface RecordedCall {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
}

function mockResponse(status: number, body: unknown = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

const calls: RecordedCall[] = [];
let respond: (url: string, init: RequestInit) => Response = () => mockResponse(200, {});

beforeEach(() => {
    calls.length = 0;
    respond = () => mockResponse(200, {});
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: unknown, init: RequestInit = {}) => {
            calls.push({
                url: String(url),
                method: init.method ?? 'GET',
                headers: (init.headers ?? {}) as Record<string, string>,
                body: init.body,
            });
            return respond(String(url), init);
        }),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function makeDoc(overrides: Partial<KbDocument> = {}): KbDocument {
    return {
        id: 'product-42',
        type: 'product',
        sourceId: '42',
        sourceSystem: 'vendure',
        url: 'https://www.example.com/zh/hot-spring',
        channelId: '37',
        channelIds: ['1', '37'],
        status: 'published',
        tags: ['温泉'],
        title: '温泉门票',
        body: '节假日通用',
        updatedAt: 1728777600000,
        ...overrides,
    };
}

describe('MeiliService 请求构造', () => {
    it('indexUid 按前缀与语言生成索引名', () => {
        const service = new MeiliService(options);
        expect(service.indexUid('zh')).toBe('kb-zh');
        expect(service.indexUid('en')).toBe('kb-en');
    });

    it('ensureIndexes: 每个 locale 先建索引再写 settings，携带鉴权头', async () => {
        const service = new MeiliService(options);
        await service.ensureIndexes();

        expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
            'POST http://127.0.0.1:7700/indexes',
            'PATCH http://127.0.0.1:7700/indexes/kb-zh/settings',
            'POST http://127.0.0.1:7700/indexes',
            'PATCH http://127.0.0.1:7700/indexes/kb-en/settings',
        ]);

        const [create] = calls;
        expect(create.headers['Authorization']).toBe('Bearer test-admin-key');
        expect(create.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(String(create.body))).toEqual({ uid: 'kb-zh', primaryKey: 'id' });

        const settings = JSON.parse(String(calls[1].body));
        expect(settings.searchableAttributes).toEqual(['title', 'body', 'tags']);
        expect(settings.filterableAttributes).toEqual([
            'type',
            'channelId',
            'channelIds',
            'status',
            'tags',
            'collectionIds',
        ]);
        expect(settings.sortableAttributes).toEqual(['updatedAt', 'price']);
    });

    it('ensureIndexes: index_already_exists 幂等不抛错，settings 照常写入', async () => {
        respond = (url, init) =>
            init.method === 'POST' && url.endsWith('/indexes')
                ? mockResponse(400, {
                      message: 'Index `kb-zh` already exists.',
                      type: 'index_already_exists',
                  })
                : mockResponse(200, {});

        const service = new MeiliService(options);
        await expect(service.ensureIndexes()).resolves.toBeUndefined();

        expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
            'POST http://127.0.0.1:7700/indexes',
            'PATCH http://127.0.0.1:7700/indexes/kb-zh/settings',
            'POST http://127.0.0.1:7700/indexes',
            'PATCH http://127.0.0.1:7700/indexes/kb-en/settings',
        ]);
    });

    it('upsertDocuments: POST documents?primaryKey=id，body 为文档数组', async () => {
        const service = new MeiliService(options);
        const doc = makeDoc();
        await service.upsertDocuments('zh', [doc]);

        const call = calls[0];
        expect(call.method).toBe('POST');
        expect(call.url).toBe('http://127.0.0.1:7700/indexes/kb-zh/documents?primaryKey=id');
        expect(call.headers['Authorization']).toBe('Bearer test-admin-key');
        expect(call.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(String(call.body))).toEqual([doc]);
    });

    it('upsertDocuments: 空数组不发请求', async () => {
        const service = new MeiliService(options);
        await service.upsertDocuments('zh', []);
        expect(calls).toHaveLength(0);
    });

    it('deleteDocuments: POST delete-batch，body 为 id 数组', async () => {
        const service = new MeiliService(options);
        await service.deleteDocuments('en', ['product-42']);

        const call = calls[0];
        expect(call.method).toBe('POST');
        expect(call.url).toBe('http://127.0.0.1:7700/indexes/kb-en/documents/delete-batch');
        expect(call.headers['Authorization']).toBe('Bearer test-admin-key');
        expect(JSON.parse(String(call.body))).toEqual(['product-42']);
    });

    it('deleteDocuments: 空数组不发请求', async () => {
        const service = new MeiliService(options);
        await service.deleteDocuments('zh', []);
        expect(calls).toHaveLength(0);
    });

    it('stats: 读取 /stats 并按 locale 输出，缺省文档数为 0', async () => {
        respond = () => mockResponse(200, { indexes: { 'kb-zh': { numberOfDocuments: 12 } } });

        const service = new MeiliService(options);
        const status = await service.stats();

        expect(calls[0]).toMatchObject({ method: 'GET', url: 'http://127.0.0.1:7700/stats' });
        expect(status).toEqual([
            { index: 'kb-zh', documents: 12, healthy: true },
            { index: 'kb-en', documents: 0, healthy: true },
        ]);
    });

    it('health: status available 返回 true', async () => {
        respond = () => mockResponse(200, { status: 'available' });

        const service = new MeiliService(options);
        await expect(service.health()).resolves.toBe(true);
        expect(calls[0]).toMatchObject({ method: 'GET', url: 'http://127.0.0.1:7700/health' });
    });

    it('health: 请求异常返回 false', async () => {
        respond = () => {
            throw new Error('ECONNREFUSED');
        };

        const service = new MeiliService(options);
        await expect(service.health()).resolves.toBe(false);
    });

    it('triggerContentReindex: 未配置 reindexUrl/sharedSecret 返回 false 且不发请求', async () => {
        const service = new MeiliService(options);
        await expect(service.triggerContentReindex()).resolves.toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('triggerContentReindex: 携带 x-zhao-secret 头 POST Strapi 路由', async () => {
        const service = new MeiliService({
            ...options,
            reindexUrl: 'http://127.0.0.1:1337/zhao-search/reindex',
            sharedSecret: 'secret-token',
        });

        await expect(service.triggerContentReindex()).resolves.toBe(true);

        const call = calls[0];
        expect(call.method).toBe('POST');
        expect(call.url).toBe('http://127.0.0.1:1337/zhao-search/reindex');
        expect(call.headers['x-zhao-secret']).toBe('secret-token');
        expect(String(call.body)).toBe('{}');
    });

    it('triggerContentReindex: Strapi 返回非 2xx 抛错', async () => {
        respond = () => mockResponse(500, { error: 'boom' });

        const service = new MeiliService({
            ...options,
            reindexUrl: 'http://127.0.0.1:1337/zhao-search/reindex',
            sharedSecret: 'secret-token',
        });
        await expect(service.triggerContentReindex()).rejects.toThrow(/500/);
    });

    it('非 2xx 响应抛出含状态码与响应体的错误', async () => {
        respond = () => mockResponse(400, { message: 'bad request' });

        const service = new MeiliService(options);
        await expect(service.upsertDocuments('zh', [makeDoc()])).rejects.toThrow(
            'Meili POST /indexes/kb-zh/documents?primaryKey=id -> 400: {"message":"bad request"}',
        );
    });
});
