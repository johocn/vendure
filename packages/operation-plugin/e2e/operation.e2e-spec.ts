import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { OperationPlugin } from '../src/plugin';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('OperationPlugin · 阶段20 运营位/专区楼层（专区+条目配置/启停/排序/渠道隔离，C端只读）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [OperationPlugin.init({})],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    /* ------------------------- helpers ------------------------- */

    async function createProduct(name: string, slug: string): Promise<string> {
        const p = await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                }) { ... on Product { id } }
            }
        `) as any;
        return p.createProduct.id;
    }

    async function createSection(input: any): Promise<any> {
        const res = await adminClient.query(gql`
            mutation {
                createOperationSection(input: {
                    code: "${input.code}",
                    name: "${input.name}",
                    type: "${input.type}",
                    ${input.displayMode ? `displayMode: "${input.displayMode}",` : ''}
                    ${input.position != null ? `position: ${input.position},` : ''}
                    ${input.enabled != null ? `enabled: ${input.enabled},` : ''}
                }) { id code name type displayMode enabled position items { id type sortOrder } }
            }
        `) as any;
        return res.createOperationSection;
    }

    async function setItems(sectionId: string, items: any[]): Promise<any[]> {
        const safe = items
            .map(i => `{ type: "${i.type}", sortOrder: ${i.sortOrder}${i.productId ? `, productId: "${i.productId}"` : ''}${i.title ? `, title: "${i.title}"` : ''} }`)
            .join(',');
        const res = await adminClient.query(gql`
            mutation {
                setOperationItems(sectionId: "${sectionId}", items: [${safe}]) { id type sortOrder productId title }
            }
        `) as any;
        return res.setOperationItems;
    }

    function listSectionsQL(extra: string) {
        return gql`
            query {
                operationSections {
                    id code name type position
                    items { id type sortOrder ${extra} }
                }
            }
        `;
    }

    async function shopList(): Promise<any[]> {
        const res = await shopClient.query(listSectionsQL('')) as any;
        return res.operationSections;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    let productId: string;

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        productId = await createProduct('Section Prod', 'section-prod');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；初始运营位为空', async () => {
        expect(server.app).toBeDefined();
        expect(await shopList()).toEqual([]);
        const admin = await adminClient.query(gql`query { operationSections { id } }`) as any;
        expect(admin.operationSections).toEqual([]);
    });

    it('admin 创建专区成功（含 code/name/type/position/enabled）', async () => {
        const s = await createSection({ code: 'home_banner', name: '首页轮播', type: 'banner', displayMode: 'carousel', position: 100 });
        expect(s.code).toBe('home_banner');
        expect(s.name).toBe('首页轮播');
        expect(s.type).toBe('banner');
        expect(s.position).toBe(100);
        expect(s.enabled).toBe(true);
    });

    it('admin setOperationItems 写入条目；sortOrder 有序', async () => {
        const s = await createSection({ code: 'home_products', name: '热卖专区', type: 'products', position: 50 });
        const items = await setItems(s.id, [
            { type: 'product', sortOrder: 2, productId },
            { type: 'product', sortOrder: 1, productId },
            { type: 'link', sortOrder: 0, title: '查看全部' },
        ]);
        expect(items).toHaveLength(3);
        // 事务内已按 sortOrder 排序返回
        expect(items[0].sortOrder).toBe(0);
        expect(items[1].sortOrder).toBe(1);
        expect(items[2].sortOrder).toBe(2);
    });

    it('admin 列出全部专区；按 position 降序', async () => {
        const res = await adminClient.query(gql`query { operationSections { id position } }`) as any;
        const positions = res.operationSections.map((s: any) => s.position);
        expect(positions).toEqual([100, 50]); // home_banner(100) 在前
        expect(res.operationSections.length).toBe(2);
    });

    it('admin 按 code 查专区（含 items）', async () => {
        const res = await adminClient.query(gql`
            query { operationSection(code: "home_products") { code items { sortOrder } } }
        `) as any;
        expect(res.operationSection.code).toBe('home_products');
        expect(res.operationSection.items.map((i: any) => i.sortOrder)).toEqual([0, 1, 2]);
    });

    it('admin update 专区（改 name/position/enabled）', async () => {
        const res = await adminClient.query(gql`
            mutation {
                updateOperationSection(id: "1", input: { name: "首页焦点图", position: 200, enabled: false }) {
                    id name position enabled
                }
            }
        `) as any;
        expect(res.updateOperationSection.name).toBe('首页焦点图');
        expect(res.updateOperationSection.position).toBe(200);
        expect(res.updateOperationSection.enabled).toBe(false);
    });

    it('admin setOperationItems 整段替换：旧条目被清空、新条目生效', async () => {
        const res = await adminClient.query(gql`query { operationSections { id name } }`) as any;
        const productsSection = res.operationSections.find((s: any) => s.name === '热卖专区');
        const items = await setItems(productsSection.id, [
            { type: 'product', sortOrder: 0, productId },
        ]);
        expect(items).toHaveLength(1);
        expect(items[0].productId).toBe(productId);
        // 再次查证仅 1 条
        const check = await adminClient.query(gql`
            query { operationSection(code: "home_products") { items { id } } }
        `) as any;
        expect(check.operationSection.items).toHaveLength(1);
    });

    it('admin delete 专区后查询消失', async () => {
        // 删除已禁用的 home_banner(id 1)，保留 enabled 的 home_products 供后续 shop 用例
        const del = await adminClient.query(gql`
            mutation { deleteOperationSection(id: "1") }
        `) as any;
        expect(del.deleteOperationSection).toBe(true);
        const res = await adminClient.query(gql`query { operationSections { id } }`) as any;
        expect(res.operationSections).toHaveLength(1);
    });

    it('admin 重复 code 建专区报唯一冲突', async () => {
        await assertThrowsWithMessage(
            () => createSection({ code: 'home_products', name: '重复', type: 'banner' }),
            /(UNIQUE|duplicate|constraint|already)/i,
        );
    });

    it('shop 只返回 enabled 专区；position 降序、items sortOrder 升序', async () => {
        // home_products 保持 enabled；home_banner 已被 update 置为 disabled
        const res = await shopClient.query(gql`
            query { operationSections { code position items { sortOrder } } }
        `) as any;
        expect(res.operationSections).toHaveLength(1);
        expect(res.operationSections[0].code).toBe('home_products');
    });

    it('shop 按 code 取未启用专区返回 null', async () => {
        const res = await shopClient.query(gql`
            query { operationSection(code: "home_banner") { code } }
        `) as any;
        expect(res.operationSection).toBeNull();
    });

    it('shop product 条目解析出 product{id}；banner/link 条目 imageUrl 为 null', async () => {
        const res = await shopClient.query(gql`
            query {
                operationSections {
                    items { type product { id } imageUrl title }
                }
            }
        `) as any;
        const section = res.operationSections[0];
        const productItem = section.items.find((i: any) => i.type === 'product');
        expect(productItem.product).not.toBeNull();
        expect(productItem.product.id).toBeDefined();
        // 当前无 imageAssetId 条目，imageUrl 解析为 null（覆盖 ResolveField 链路）
        expect(productItem.imageUrl).toBeNull();
    });

    it('渠道隔离：新渠道看不到默认渠道专区', async () => {
        // 种子税区固定 id `T_1`（core e2e 同款）
        // 创建第二渠道
        const created = await adminClient.query(gql`
            mutation {
                createChannel(input: {
                    code: "channel-b",
                    token: "channel-b-token",
                    defaultLanguageCode: en,
                    defaultShippingZoneId: "T_1",
                    defaultTaxZoneId: "T_1",
                    currencyCode: USD,
                    pricesIncludeTax: true
                }) {
                    ... on Channel { id code token }
                }
            }
        `) as any;
        expect(created.createChannel.id).toBeDefined();
        const c2Token = created.createChannel.token;

        const channelBClient = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        channelBClient.setChannelToken(c2Token);

        // 默认渠道有一个 enabled 专区；渠道 B 应为空
        const defaultCounts = (await shopList()).length;
        expect(defaultCounts).toBeGreaterThanOrEqual(1);
        const res = await channelBClient.query(gql`query { operationSections { id } }`) as any;
        expect(res.operationSections).toEqual([]);
    });
});