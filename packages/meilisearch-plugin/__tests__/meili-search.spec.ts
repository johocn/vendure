import { afterEach, describe, expect, test, vi } from 'vitest';
import { MeiliService } from '../src/meili.service';

const opts = {
    host: 'http://127.0.0.1:7700',
    adminKey: 'master',
    indexPrefix: 'kb',
    locales: ['zh', 'en'],
};

function mockFetch(response: any) {
    const calls: Array<{ url: string; init: any }> = [];
    vi.stubGlobal('fetch', async (url: string, init?: any) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => response, text: async () => JSON.stringify(response) };
    });
    return calls;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('MeiliService.search', () => {
    test('assembles product filter + channel filter and maps hits', async () => {
        const calls = mockFetch({
            hits: [{ id: 'product-1', type: 'product', sourceId: '1', title: '酱油', price: 890 }],
            estimatedTotalHits: 1,
            processingTimeMs: 3,
        });
        const svc = new MeiliService(opts);
        const r = await svc.search('zh', { q: '酱油', channelId: '2', limit: 5 });
        expect(r.hits.length).toBe(1);
        expect(r.total).toBe(1);
        expect(r.processingTimeMs).toBe(3);
        const url = calls[0].url;
        const body = JSON.parse(calls[0].init.body);
        expect(url).toBe('http://127.0.0.1:7700/indexes/kb-zh/search');
        expect(body.q).toBe('酱油');
        expect(body.limit).toBe(5);
        expect(body.filter).toEqual(["type = 'product'", "status = 'published'", "channelIds = '2'"]);
    });

    test('escapes single quotes in channelId and applies defaults', async () => {
        const calls = mockFetch({ hits: [], estimatedTotalHits: 0 });
        const svc = new MeiliService(opts);
        await svc.search('en', { q: 'oBrien', channelId: "a'b" });
        const body = JSON.parse(calls[0].init.body);
        expect(body.filter).toEqual(["type = 'product'", "status = 'published'", "channelIds = 'a''b'"]);
        expect(body.limit).toBe(10);
        expect(body.offset).toBe(0);
    });
});
