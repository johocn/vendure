import { describe, expect, it } from 'vitest';

import { AssistantSearchService } from './search-adapter';

function makeService(hits: any[]): AssistantSearchService {
    return new AssistantSearchService({ search: async () => ({ hits }) } as any);
}

describe('AssistantSearchService.toCardProduct（卡片 URL 详情页拼装）', () => {
    it('storefrontUrl + slug → 拼商品详情页绝对地址', async () => {
        const svc = makeService([
            { sourceId: '73', title: '洗车', price: 2000, slug: 'liyang-auto', url: 'https://e.joho.cn/liyang-auto', thumbnail: 'https://e.joho.cn/assets/preview/a.jpeg' },
        ]);
        const r = await svc.searchProducts({ query: '洗车', channelId: '37', locale: 'zh', limit: 5, storefrontUrl: 'https://e.joho.cn/' });
        expect(r[0].url).toBe('https://e.joho.cn/product/liyang-auto');
        expect(r[0].thumbnail).toBe('https://e.joho.cn/assets/preview/a.jpeg');
    });

    it('无 storefrontUrl → 退回文档 url 原样', async () => {
        const svc = makeService([
            { sourceId: '73', title: '洗车', price: 2000, slug: 'liyang-auto', url: '/liyang-auto' },
        ]);
        const r = await svc.searchProducts({ query: '洗车', channelId: '37', locale: 'zh', limit: 5, storefrontUrl: '' });
        expect(r[0].url).toBe('/liyang-auto');
    });

    it('slug 缺失 → 从文档 url 末段取 slug', async () => {
        const svc = makeService([
            { sourceId: '73', title: '洗车', price: 2000, url: '/liyang-auto' },
        ]);
        const r = await svc.searchProducts({ query: '洗车', channelId: '37', locale: 'zh', limit: 5, storefrontUrl: 'https://e.joho.cn' });
        expect(r[0].slug).toBe('liyang-auto');
        expect(r[0].url).toBe('https://e.joho.cn/product/liyang-auto');
    });
});
