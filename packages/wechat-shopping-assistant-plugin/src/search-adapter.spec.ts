import { describe, expect, it } from 'vitest';

import { AssistantSearchService } from './search-adapter';

function makeService(hits: any[]): AssistantSearchService {
    return new AssistantSearchService({ search: async () => ({ hits }) } as any);
}

describe('AssistantSearchService 检索策略', () => {
    it('标题全等/短标题优先，正文命中去重后靠后', async () => {
        const titleHits = [
            { sourceId: '119', title: '五得利 八星雪花小麦粉 5kg 麦芯粉 家庭面点', price: 2990 },
            { sourceId: '98', title: '雪花粉', price: 1290 },
            { sourceId: '104', title: '有机雪花粉', price: 4990 },
        ];
        const allHits = [...titleHits, { sourceId: '88', title: '吉林小町米', price: 1990 }];
        const calls: any[] = [];
        const svc = new AssistantSearchService({
            search: async (_locale: string, params: any) => {
                calls.push(params);
                return { hits: params.attributesToSearchOn ? titleHits : allHits };
            },
        } as any);
        const r = await svc.searchProducts({
            query: '雪花',
            channelId: '111',
            locale: 'zh',
            limit: 5,
            storefrontUrl: 'https://shop.example.com',
        });
        expect(r.map(x => x.productId)).toEqual(['98', '104', '119', '88']);
        expect(calls[0].attributesToSearchOn).toEqual(['title']);
        expect(calls[0].limit).toBe(20);
        expect(calls[1].attributesToSearchOn).toBeUndefined();
    });

    it('空关键词不检索', async () => {
        let called = false;
        const svc = new AssistantSearchService({
            search: async () => {
                called = true;
                return { hits: [] };
            },
        } as any);
        const r = await svc.searchProducts({
            query: '  ',
            channelId: '111',
            locale: 'zh',
            limit: 5,
            storefrontUrl: 'https://shop.example.com',
        });
        expect(r).toEqual([]);
        expect(called).toBe(false);
    });
});

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

    it('productUrlTemplate 优先（hash 路由前端），{slug} 占位符 encodeURIComponent', async () => {
        const svc = makeService([
            { sourceId: '73', title: '洗车', price: 2000, slug: '利洋汽修', url: 'https://e.joho.cn/利洋汽修' },
        ]);
        const r = await svc.searchProducts({
            query: '洗车',
            channelId: '37',
            locale: 'zh',
            limit: 5,
            storefrontUrl: 'https://e.joho.cn',
            productUrlTemplate: 'https://e.joho.cn/#/pkg-product/pages/detail?slug={slug}',
        });
        expect(r[0].url).toBe(
            'https://e.joho.cn/#/pkg-product/pages/detail?slug=%E5%88%A9%E6%B4%8B%E6%B1%BD%E4%BF%AE',
        );
    });
});
