import path from 'path';
import gql from 'graphql-tag';
import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { mergeConfig } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { MerchantPlugin } from '../src/merchant.plugin';

/**
 * 门店主数据 e2e：真实 DB（sqljs）+ 真实 GraphQL schema。
 * 覆盖：建商户/建店 → C 端公开查询（营业中/距离）→ 停业后 isOpenNow=false → 租户认领。
 */
registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('MerchantPlugin · 门店主数据闭环', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [MerchantPlugin.init()],
        }),
    );

    let merchantId: string;
    let storeId: string;

    beforeAll(async () => {
        await server.init(
            {
                initialData,
                productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            },
            { install: ['sqljs'] },
        );
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('建商户 + 建门店', async () => {
        const merchantResult: any = await adminClient.query(gql`
            mutation {
                createMerchant(
                    input: {
                        code: "M-TEST-1"
                        name: "测试商户"
                        legalName: "测试商户有限公司"
                        contactName: "张三"
                        servicePhone: "0431-88886666"
                        city: "长春市"
                        address: "自由大路 1 号"
                    }
                ) {
                    id
                    code
                    name
                    claimStatus
                }
            }
        `);
        const merchant = merchantResult.createMerchant;
        expect(merchant.code).toBe('M-TEST-1');
        expect(merchant.name).toBe('测试商户');
        expect(merchant.claimStatus).toBe('UNCLAIMED');
        merchantId = merchant.id;

        const storeResult: any = await adminClient.query(gql`
            mutation CreateStore($merchantId: ID!) {
                createMerchantStore(
                    input: {
                        merchantId: $merchantId
                        code: "S-TEST-1"
                        name: "自由大路店"
                        addressLine: "自由大路 88 号"
                        city: "长春市"
                        district: "朝阳区"
                        phoneNumber: "0431-88886666"
                        businessHoursText: "09:00-21:00"
                        lat: 43.8356
                        lng: 125.3335
                        photos: ["https://example.com/store.jpg"]
                    }
                ) {
                    id
                    code
                    name
                    status
                    phoneNumber
                    businessHoursText
                }
            }
        `, { merchantId });
        const store = storeResult.createMerchantStore;
        expect(store.code).toBe('S-TEST-1');
        expect(store.status).toBe('OPEN');
        storeId = store.id;

        const list: any = await adminClient.query(gql`
            query { merchantStores(options: { merchantId: "${merchantId}" }) { totalItems items { id name } } }
        `);
        expect(list.merchantStores.totalItems).toBe(1);
    });

    it('C 端公开查询返回营业状态、距离与联系方式', async () => {
        const result: any = await shopClient.query(gql`
            query {
                merchantStores(lat: 43.83, lng: 125.33, limit: 10) {
                    id
                    name
                    address
                    phoneNumber
                    businessHoursText
                    isOpenNow
                    distanceKm
                    coordinates { lat lng }
                    photos
                }
            }
        `);
        expect(result.merchantStores).toHaveLength(1);
        const s = result.merchantStores[0];
        expect(s.name).toBe('自由大路店');
        expect(s.phoneNumber).toBe('0431-88886666');
        expect(s.businessHoursText).toBe('09:00-21:00');
        expect(s.isOpenNow).toBe(true);
        expect(typeof s.distanceKm).toBe('number');
        expect(s.coordinates.lng).toBeCloseTo(125.3335, 3);
    });

    it('门店临时停业 → isOpenNow 变 false，但不能编造营业状态', async () => {
        await adminClient.query(gql`
            mutation {
                updateMerchantStore(
                    input: { id: "${storeId}", status: "TEMP_CLOSED", statusNote: "装修" }
                ) {
                    id
                    status
                }
            }
        `);
        const result: any = await shopClient.query(gql`
            query { merchantStorePublic(id: "${storeId}") { id status isOpenNow } }
        `);
        expect(result.merchantStorePublic.status).toBe('TEMP_CLOSED');
        expect(result.merchantStorePublic.isOpenNow).toBe(false);
    });

    it('租户可认领门店（合作开关只插一行关系）', async () => {
        const channels: any = await adminClient.query(gql`query { channels { items { id code } } }`);
        const channelId = channels.channels.items[0].id;
        const claim: any = await adminClient.query(gql`
            mutation Claim($storeId: ID!, $channelId: ID!) {
                claimMerchantStore(storeId: $storeId, channelId: $channelId, role: "OWNER", contractNo: "HT-001") {
                    id
                    storeId
                    channelId
                    role
                    status
                    contractNo
                }
            }
        `, { storeId, channelId });
        expect(claim.claimMerchantStore.status).toBe('ACTIVE');
        expect(claim.claimMerchantStore.role).toBe('OWNER');
        expect(claim.claimMerchantStore.contractNo).toBe('HT-001');

        const again: any = await adminClient.query(gql`
            mutation Claim($storeId: ID!, $channelId: ID!) {
                claimMerchantStore(storeId: $storeId, channelId: $channelId) { id status }
            }
        `, { storeId, channelId });
        expect(again.claimMerchantStore.id).toBe(claim.claimMerchantStore.id);
    });
});
