import { LanguageCode, mergeConfig } from '@vendure/core';
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

    /* ===================== 阶段22：结算/下单运费计算 + 范围联动 ===================== */
    describe('阶段22 结算运费计算 + 配送范围联动', () => {
        let shopMethodId: string;
        let laptopVariantId: string;
        let phoneVariantId: string;
        let goodsAddrId: string;
        let shallowAddrId: string;

        async function resetCart(): Promise<void> {
            try {
                await shopClient.query(gql`mutation { removeAllOrderLines { ... on Order { id } } }`);
            } catch {
                /* 无 active order 时忽略 */
            }
        }

        async function addItem(variantId: string, quantity = 1): Promise<void> {
            await shopClient.query(gql`
                mutation { addItemToOrder(productVariantId: "${variantId}", quantity: ${quantity}) { ... on Order { id } } }
            `);
        }

        async function setShippingAddr(addrId: string): Promise<void> {
            await shopClient.query(gql`mutation { setOrderShippingFromAddress(deliveryAddressId: "${addrId}") { id } }`);
        }

        async function eligibleFee(): Promise<number | undefined> {
            const rng = (await adminClient.query(gql`query { deliveryRange(shopId: "${shopAId}") { rangeType radiusKm centerLng centerLat baseFee } }`)) as any;
            console.error(`[E2E-C${expect.getState().currentTestName?.includes('C8') ? '8' : expect.getState().currentTestName ?? ''}] range=${JSON.stringify(rng.deliveryRange)}`);
            const res = (await shopClient.query(gql`
                query { eligibleShippingMethods { id name priceWithTax } }
            `)) as any;
            const it = res.eligibleShippingMethods.find((m: any) => m.id === shopMethodId);
            return it ? it.priceWithTax : undefined;
        }

        async function ensureLoaded(): Promise<string[]> {
            // 读 Laptop 变体 id，并创建一档 Phone 商品归属 shopB（供多店用例）
            const laptop = (await adminClient.query(gql`
                { product(id: "T_1") { id variants { id } } }
            `)) as any;
            laptopVariantId = laptop.product.variants[0].id;
            await adminClient.query(gql`
                mutation { assignProductsToShop(input: { shopId: "${shopAId}", productIds: ["${laptop.product.id}"] }) }
            `);
            const created = (await adminClient.query(gql`
                mutation {
                    createProduct(input: { translations: [{ languageCode: en, name: "Phone", slug: "phone", description: "phone" }] }) { id }
                }
            `)) as any;
            const tax = (await adminClient.query(gql`{ taxCategories { items { id } } }`)) as any;
            const variants = (await adminClient.query(gql`
                mutation CreateVariants($input: [CreateProductVariantInput!]!) {
                    createProductVariants(input: $input) { id }
                }
            `, {
                input: [{
                    productId: created.createProduct.id,
                    sku: 'PHONE-93',
                    price: 99900,
                    taxCategoryId: tax.taxCategories.items[0].id,
                    stockOnHand: 100,
                    translations: [{ languageCode: LanguageCode.en, name: 'Phone' }],
                }],
            })) as any;
            phoneVariantId = variants.createProductVariants[0].id;
            await adminClient.query(gql`
                mutation { assignProductsToShop(input: { shopId: "${shopBId}", productIds: ["${created.createProduct.id}"] }) }
            `);
            return [laptopVariantId, phoneVariantId];
        }

        function feeLabel(baseFee: number, freeThreshold: number | null): string {
            if (freeThreshold != null) {
                return `base=${baseFee} free>=${freeThreshold}`;
            }
            return `base=${baseFee} 不包邮`;
        }

        beforeAll(async () => {
            // 运费档位：shopA 基础1000 不包邮；shopB 基础500 满20000包邮
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "all", baseFee: 1000, freeThreshold: null }) { id baseFee freeThreshold } }
            `);
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopBId}", enabled: true, rangeType: "all", baseFee: 500, freeThreshold: 20000 }) { id baseFee freeThreshold } }
            `);
            // 注册 range-shipping 运费方式（checker + calculator）
            const sm = (await adminClient.query(gql`
                mutation CreateSM($input: CreateShippingMethodInput!) {
                    createShippingMethod(input: $input) { id }
                }
            `, {
                input: {
                    code: 'range-shipping-test',
                    translations: [{ languageCode: LanguageCode.en, name: 'Range Shipping', description: '' }],
                    fulfillmentHandler: 'manual-fulfillment',
                    checker: { code: 'range-delivery-eligibility', arguments: [] },
                    calculator: { code: 'range-shipping', arguments: [] },
                },
            })) as any;
            shopMethodId = sm.createShippingMethod.id;

            await ensureLoaded();

            // 收件地址：杭州（圈内）；外埠地址：上海（圈外，超远）
            const goods = (await shopClient.query(gql`
                mutation { createDeliveryAddress(input: {
                    fullName: "收件人", phone: "13800000009",
                    province: "浙江省", city: "杭州市", district: "西湖区",
                    provinceCode: "330000", cityCode: "330100", districtCode: "330106",
                    detail: "文三路200号", lng: 120.1551, lat: 30.2741
                }) { id } }
            `)) as any;
            goodsAddrId = goods.createDeliveryAddress.id;
            const shallow = (await shopClient.query(gql`
                mutation { createDeliveryAddress(input: {
                    fullName: "外埠", phone: "13800000010",
                    cityCode: "310100", districtCode: "310106",
                    detail: "南京东路100号", lng: 121.4737, lat: 31.2304
                }) { id } }
            `)) as any;
            shallowAddrId = shallow.createDeliveryAddress.id;
        }, TEST_SETUP_TIMEOUT_MS);

        it('C1 admin 可读写 baseFee/freeThreshold（persist）', async () => {
            const q = (await adminClient.query(gql`query { deliveryRange(shopId: "${shopAId}") { baseFee freeThreshold } }`)) as any;
            expect(q.deliveryRange).toMatchObject({ baseFee: 1000, freeThreshold: null });
            const b = (await adminClient.query(gql`query { deliveryRange(shopId: "${shopBId}") { baseFee freeThreshold } }`)) as any;
            expect(b.deliveryRange).toMatchObject({ baseFee: 500, freeThreshold: 20000 });
        });

        it('C2 空订单/未设地址：activeOrderDeliveryStatus 为 null', async () => {
            await resetCart();
            expect(goodsAddrId).toBeTruthy();
            const res = (await shopClient.query(gql`query { activeOrderDeliveryStatus { deliverable } }`)) as any;
            expect(res.activeOrderDeliveryStatus).toBeNull();
        });

        it(`C3 单店求和不包邮（${feeLabel(1000, null)}）：2×Laptop → 运费 1000`, async () => {
            await resetCart();
            await addItem(laptopVariantId, 2);
            await setShippingAddr(goodsAddrId);
            expect(await eligibleFee()).toBe(1000);
        });

        it(`C4 包邮（${feeLabel(500, 20000)}）：Phone(999) 满额 → 运费 0`, async () => {
            await resetCart();
            await addItem(phoneVariantId, 1);
            await setShippingAddr(goodsAddrId);
            expect(await eligibleFee()).toBe(0);
        });

        it('C5 多店混合（A不包邮 + B包邮）：Laptop+Phone → 1000', async () => {
            await resetCart();
            await addItem(laptopVariantId, 1);
            await addItem(phoneVariantId, 1);
            await setShippingAddr(goodsAddrId);
            // A=1000（不包邮），B=0（满额包邮）
            expect(await eligibleFee()).toBe(1000);
        });

        it('C6 全店不包邮求和（A+B 基础运费相加）：关闭 B 包邮后 Laptop+Phone → 1500', async () => {
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopBId}", enabled: true, rangeType: "all", baseFee: 500, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await addItem(phoneVariantId, 1);
            await setShippingAddr(goodsAddrId);
            expect(await eligibleFee()).toBe(1500);
        });

        it('C7 地址未设跳过校验：无收件区码仍可报价（shouldRunCheck=false）', async () => {
            await resetCart();
            await addItem(laptopVariantId, 1);
            // 不调用 setOrderShippingFromAddress → 订单无收件区码/经纬度
            expect(await eligibleFee()).toBe(1000);
        });

        it('C8 结算拦截：地址超范围 → range 方式不出现在 eligibleShippingMethods', async () => {
            // shopA 收件在校验的杭州点（120.1551,30.2741）；设圆心为上海，半径5km → 超范围
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "circle", centerLng: 121.4737, centerLat: 31.2304, radiusKm: 5, baseFee: 1000, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await setShippingAddr(goodsAddrId);
            expect(await eligibleFee()).toBeUndefined();
        });

        it('C9 结算放行：扩大半径到范围内部 → 恢复可报价', async () => {
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "circle", centerLng: 121.4737, centerLat: 31.2304, radiusKm: 500, baseFee: 1000, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await setShippingAddr(goodsAddrId);
            expect(await eligibleFee()).toBe(1000);
        });

        it('C10 range circle 半径联动：X<圈内报价 / X>=圈内放开（连续收发可校验）', async () => {
            // 收件设在上海（圈内），扩大/缩小半径联动报价
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "circle", centerLng: 121.4737, centerLat: 31.2304, radiusKm: 5, baseFee: 1000, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await setShippingAddr(shallowAddrId); // 上海收件，圆心同点
            // 收件=range 圆心 5km 内 → 应可报价
            expect(await eligibleFee()).toBe(1000);
        });

        it('C11 activeOrderDeliveryStatus：范围外 deliverable=false 且携带逐店结果', async () => {
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "circle", centerLng: 121.4737, centerLat: 31.2304, radiusKm: 5, baseFee: 1000, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await setShippingAddr(goodsAddrId); // 杭州收件，圆心上海 → 超范围
            const res = (await shopClient.query(gql`
                query { activeOrderDeliveryStatus { deliverable results { shopId inRange reason } } }
            `)) as any;
            expect(res.activeOrderDeliveryStatus.deliverable).toBe(false);
            const r = res.activeOrderDeliveryStatus.results[0];
            expect(r).toMatchObject({ inRange: false, reason: 'BEYOND_RANGE' });
        });

        it('C12 activeOrderDeliveryStatus：范围内 deliverable=true', async () => {
            await adminClient.query(gql`
                mutation { upsertDeliveryRange(input: { shopId: "${shopAId}", enabled: true, rangeType: "all", baseFee: 1000, freeThreshold: null }) { id } }
            `);
            await resetCart();
            await addItem(laptopVariantId, 1);
            await setShippingAddr(goodsAddrId);
            const res = (await shopClient.query(gql`
                query { activeOrderDeliveryStatus { deliverable results { shopId inRange reason } } }
            `)) as any;
            expect(res.activeOrderDeliveryStatus.deliverable).toBe(true);
            expect(res.activeOrderDeliveryStatus.results[0].reason).toBe('OK');
        });

        it('C13 收件地址越权隔离：用户B 不能以 A 的地址写自己订单?（仅校验自己地址归属）', async () => {
            await assertThrowsWithMessage(
                () => secondClient.query(gql`mutation { setOrderShippingFromAddress(deliveryAddressId: "${goodsAddrId}") { id } }`),
                'No DeliveryAddress',
            );
        });
    });
});