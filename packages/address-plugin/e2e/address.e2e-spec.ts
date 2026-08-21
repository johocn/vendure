import { mergeConfig } from '@vendure/core';
import { ShopPlugin } from '@vendure/shop-plugin';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

import { AddressPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('AddressPlugin · 阶段21 收货地址 + 按店配送范围（CRUD/默认/隔离/地理/区划校验）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), AddressPlugin.init({})],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let shopAId: string;
    let shopBId: string;
    let secondClient: SimpleGraphQLClient;

    /* ------------------------- helpers ------------------------- */

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) {
                    id name slug status
                }
            }
        `)) as any;
        await adminClient.query(gql`mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }`);
        return res.createShop.id;
    }

    async function createAddress(client: SimpleGraphQLClient, input: string): Promise<string> {
        const res = (await client.query(gql`
            mutation { createDeliveryAddress(input: { ${input} }) { id fullName isDefault } }
        `)) as any;
        return res.createDeliveryAddress;
    }

    async function upsertRange(input: string): Promise<any> {
        const res = (await adminClient.query(gql`
            mutation { upsertDeliveryRange(input: { ${input} }) { id shopId enabled rangeType districtCodes } }
        `)) as any;
        return res.upsertDeliveryRange;
    }

    async function validate(address: string, shopIds: string[]): Promise<any[]> {
        const ids = shopIds.map(id => `"${id}"`).join(',');
        const res = (await shopClient.query(gql`
            query { validateDelivery(input: { address: { ${address} }, shopIds: [${ids}] }) { shopId inRange reason } }
        `)) as any;
        return res.validateDelivery;
    }

    /* ------------------------- setup ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        shopAId = await createShop('Shop A', 'shop-a');
        shopBId = await createShop('Shop B', 'shop-b');

        // 主用户
        const main = (await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Main", lastName: "User", emailAddress: "main.addr@test.com" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `)) as any;
        expect(main.createCustomer.id).toBeDefined();
        await shopClient.asUserWithCredentials('main.addr@test.com', 'test');

        // 第二用户（越权隔离校验）
        const second = (await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Second", lastName: "User", emailAddress: "second.addr@test.com" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `)) as any;
        expect(second.createCustomer.id).toBeDefined();
        secondClient = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await secondClient.asUserWithCredentials('second.addr@test.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；地址簿初始为空', async () => {
        expect(server.app).toBeDefined();
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        expect(res.myDeliveryAddresses).toEqual([]);
    });

    it('未登录访问地址簿被拒', async () => {
        const anon = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await assertThrowsWithMessage(
            () => anon.query(gql`query { myDeliveryAddresses { id } }`),
            'not authorized',
        );
    });

    it('新建地址：首条自动设为默认', async () => {
        const addr = await createAddress(
            shopClient,
            `fullName: "张三", phone: "13800000001", province: "浙江省", city: "杭州市", district: "西湖区",
             provinceCode: "330000", cityCode: "330100", districtCode: "330106", detail: "文三路100号"`,
        );
        expect(addr.isDefault).toBe(true);
    });

    it('新建第二条不默认为默认；列表仅含本人地址且按创建顺序', async () => {
        const addr2 = await createAddress(
            shopClient,
            `fullName: "李四", phone: "13800000002", detail: "解放路200号"`,
        );
        expect(addr2.isDefault).toBe(false);
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { fullName isDefault } }`)) as any;
        expect(res.myDeliveryAddresses).toHaveLength(2);
        expect(res.myDeliveryAddresses[0].fullName).toBe('张三');
        expect(res.myDeliveryAddresses.map((a: any) => a.isDefault)).toEqual([true, false]);
    });

    it('更新地址字段生效', async () => {
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        const id = res.myDeliveryAddresses[0].id;
        const upd = (await shopClient.query(gql`
            mutation { updateDeliveryAddress(id: "${id}", input: { fullName: "张三改", phone: "13800000099" }) { id fullName phone } }
        `)) as any;
        expect(upd.updateDeliveryAddress.fullName).toBe('张三改');
        expect(upd.updateDeliveryAddress.phone).toBe('13800000099');
    });

    it('setDefaultDeliveryAddress 保证全局唯一默认', async () => {
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        const second = res.myDeliveryAddresses[1].id;
        const list = (await shopClient.query(gql`
            mutation { setDefaultDeliveryAddress(id: "${second}") { id isDefault } }
        `)) as any;
        expect(list.setDefaultDeliveryAddress.filter((a: any) => a.isDefault)).toHaveLength(1);
        expect(list.setDefaultDeliveryAddress.find((a: any) => a.id === second).isDefault).toBe(true);
    });

    it('删除地址成功；删除后列表收缩', async () => {
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        const keep = res.myDeliveryAddresses[0];
        const del = res.myDeliveryAddresses[1].id;
        const ok = (await shopClient.query(gql`mutation { deleteDeliveryAddress(id: "${del}") }`)) as any;
        expect(ok.deleteDeliveryAddress).toBe(true);
        const after = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        expect(after.myDeliveryAddresses).toHaveLength(1);
        expect(after.myDeliveryAddresses[0].id).toBe(keep.id);
    });

    it('越权隔离：用户 B 看不到/改不了 A 的地址', async () => {
        const res = (await shopClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        const aOnly = res.myDeliveryAddresses[0].id;
        const bList = (await secondClient.query(gql`query { myDeliveryAddresses { id } }`)) as any;
        expect(bList.myDeliveryAddresses).toEqual([]);
        await assertThrowsWithMessage(
            () => secondClient.query(gql`mutation { deleteDeliveryAddress(id: "${aOnly}") }`),
            'No DeliveryAddress',
        );
        // B 可建自己的地址
        const bAddr = await createAddress(secondClient, `fullName: "王五", phone: "13900000003"`);
        expect(bAddr.isDefault).toBe(true);
    });

    it('admin upsert 配送范围（all 型）可读回', async () => {
        const range = await upsertRange(`shopId: "${shopAId}", enabled: true, rangeType: "all"`);
        expect(range.rangeType).toBe('all');
        const q = (await adminClient.query(gql`query { deliveryRange(shopId: "${shopAId}") { enabled rangeType } }`)) as any;
        expect(q.deliveryRange)?.not?.toBe(null);
        expect(q.deliveryRange.enabled).toBe(true);
    });

    it('validateDelivery：无范围/未启用 → NO_DELIVERY', async () => {
        // shopB 尚未配置范围
        const r1 = await validate(`fullName: "张三", phone: "13800000001"`, [shopBId]);
        expect(r1[0]).toMatchObject({ inRange: false, reason: 'NO_DELIVERY' });
    });

    it('validateDelivery：all 型 → OK', async () => {
        const r = await validate(`fullName: "张三", phone: "13800000001"`, [shopAId]);
        expect(r[0]).toMatchObject({ shopId: shopAId, inRange: true, reason: 'OK' });
    });

    it('validateDelivery：circle 型（范围内 OK / 范围外 BEYOND_RANGE / 无坐标 NO_COORDINATES）', async () => {
        await upsertRange(
            `shopId: "${shopAId}", enabled: true, rangeType: "circle", centerLng: 120.1551, centerLat: 30.2741, radiusKm: 10`,
        );
        // 范围内：同点附近（约 0.3km）
        const inside = await validate(
            `fullName: "张三", phone: "13800000001", lng: 120.1600, lat: 30.2800`,
            [shopAId],
        );
        expect(inside[0]).toMatchObject({ inRange: true, reason: 'OK' });
        // 范围外：上海（约 165km）
        const beyond = await validate(
            `fullName: "孙七", phone: "13800000005", lng: 121.4737, lat: 31.2304`,
            [shopAId],
        );
        expect(beyond[0]).toMatchObject({ inRange: false, reason: 'BEYOND_RANGE' });
        // 无坐标：circle 型缺经纬度
        const noCoord = await validate(`fullName: "张三", phone: "13800000001"`, [shopAId]);
        expect(noCoord[0]).toMatchObject({ inRange: false, reason: 'NO_COORDINATES' });
    });

    it('validateDelivery：district 型（命中/兜底市/未命中 NOT_IN_RANGE）', async () => {
        await upsertRange(
            `shopId: "${shopBId}", enabled: true, rangeType: "district", districtCodes: ["330106", "330100"]`,
        );
        // 命中区码
        const hit = await validate(
            `fullName: "张三", phone: "13800000001", districtCode: "330106"`,
            [shopBId],
        );
        expect(hit[0]).toMatchObject({ inRange: true, reason: 'OK' });
        // 兜底市码命中（无区码，只有市码）
        const cityHit = await validate(
            `fullName: "张三", phone: "13800000001", cityCode: "330100"`,
            [shopBId],
        );
        expect(cityHit[0]).toMatchObject({ inRange: true, reason: 'OK' });
        // 未命中
        const miss = await validate(
            `fullName: "周八", phone: "13800000008", districtCode: "330110"`,
            [shopBId],
        );
        expect(miss[0]).toMatchObject({ inRange: false, reason: 'NOT_IN_RANGE' });
    });

    it('upsertRange 幂等：同一店重复 upsert 不产生多档', async () => {
        await upsertRange(`shopId: "${shopBId}", enabled: true, rangeType: "district", districtCodes: ["330106"]`);
        await upsertRange(`shopId: "${shopBId}", enabled: true, rangeType: "district", districtCodes: ["330106", "330108"]`);
        // 覆盖更新后，只保留最新白名单
        const r = await validate(`fullName: "张三", phone: "13800000001", districtCode: "330108"`, [shopBId]);
        expect(r[0]).toMatchObject({ inRange: true, reason: 'OK' });
    });

    it('validateDelivery 支持多店批量查询（含未过期/无范围混合）', async () => {
        // shopA 现为 circle，shopB 现为 district
        const res = await validate(
            `fullName: "张三", phone: "13800000001", districtCode: "330106", lng: 120.1600, lat: 30.2800`,
            [shopAId, shopBId],
        );
        expect(res).toHaveLength(2);
        const byShop: Record<string, any> = Object.fromEntries(res.map(r => [r.shopId, r]));
        expect(byShop[shopAId]).toMatchObject({ inRange: true, reason: 'OK' });
        expect(byShop[shopBId]).toMatchObject({ inRange: true, reason: 'OK' });
    });
});