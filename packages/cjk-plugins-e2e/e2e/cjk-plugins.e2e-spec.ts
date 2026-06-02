import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CjkPlugin } from '@vendure/cjk-plugin';
import { InvoicePlugin } from '@vendure/invoice-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';
import { DistributionPlugin } from '@vendure/distribution-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('CJK Plugins Integration', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: {
                port: 3900,
            },
            plugins: [
                CjkPlugin.init({
                    i18n: { enabled: true },
                    regions: { enabled: true },
                    tenant: { enabled: true },
                }),
                OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
                InvoicePlugin.init(),
                LogisticsPlugin.init(),
                GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
                FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
                DistributionPlugin.init({
                    defaultDirectRate: 1000,
                    defaultIndirectRate: 500,
                    minWithdrawalAmount: 10000,
                    settlementDays: 7,
                }),
            ],
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData: {
                defaultLanguage: LanguageCode.zh_Hans,
                defaultZone: 'China',
                countries: [{ code: 'CN', name: 'China', zone: 'Asia' }],
                taxRates: [{ name: 'Standard Tax', percentage: 13 }],
                shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
                paymentMethods: [],
                collections: [],
            },
            productsCsvPath: '',
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('server starts without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('GroupBuy admin API is accessible', async () => {
        const result = await adminClient.query(gql`
            query {
                groupBuyActivities(options: {}) {
                    items { id name status }
                    totalItems
                }
            }
        `);
        expect(result.groupBuyActivities).toBeDefined();
        expect(result.groupBuyActivities.items).toEqual([]);
        expect(result.groupBuyActivities.totalItems).toBe(0);
    });

    it('GroupBuy shop API is accessible', async () => {
        const result = await shopClient.query(gql`
            query {
                activeGroupBuyActivities {
                    id name status
                }
            }
        `);
        expect(result.activeGroupBuyActivities).toBeDefined();
    });

    it('FlashSale admin API is accessible', async () => {
        const result = await adminClient.query(gql`
            query {
                flashSaleActivities(options: {}) {
                    items { id name status }
                    totalItems
                }
            }
        `);
        expect(result.flashSaleActivities).toBeDefined();
        expect(result.flashSaleActivities.items).toEqual([]);
    });

    it('FlashSale shop API is accessible', async () => {
        const result = await shopClient.query(gql`
            query {
                activeFlashSaleActivities {
                    id name status
                }
            }
        `);
        expect(result.activeFlashSaleActivities).toBeDefined();
    });

    it('Distribution admin API is accessible', async () => {
        const result = await adminClient.query(gql`
            query {
                distributors(options: {}) {
                    items { id referralCode status }
                    totalItems
                }
            }
        `);
        expect(result.distributors).toBeDefined();
        expect(result.distributors.items).toEqual([]);
    });

    it('Distribution shop API is accessible', async () => {
        const result = await shopClient.query(gql`
            query {
                myDistributorProfile {
                    id referralCode
                }
            }
        `);
        expect(result.myDistributorProfile).toBeNull();
    });

    it('Channel CustomFields are registered', async () => {
        const result = await adminClient.query(gql`
            query {
                channels {
                    items {
                        id
                        code
                        customFields {
                            orderTimeoutMinutes
                            shippingStrategy
                            distributionEnabled
                        }
                    }
                }
            }
        `);
        expect(result.channels.items.length).toBeGreaterThan(0);
        const channel = result.channels.items[0];
        expect(channel.customFields).toBeDefined();
        expect(channel.customFields.orderTimeoutMinutes).toBe(30);
        expect(channel.customFields.shippingStrategy).toBe('priority');
        expect(channel.customFields.distributionEnabled).toBe(false);
    });

    it('can create a GroupBuyActivity', async () => {
        const now = new Date();
        const startAt = new Date(now.getTime() + 3600000);
        const endAt = new Date(now.getTime() + 86400000);
        const result = await adminClient.query(gql`
            mutation {
                createGroupBuyActivity(input: {
                    name: "Test Group Buy"
                    description: "Test"
                    targetCount: 3
                    maxCount: 5
                    startAt: "${startAt.toISOString()}"
                    endAt: "${endAt.toISOString()}"
                    groupPrice: 9900
                    leaderDiscount: 1000
                    autoConfirm: true
                    allowJoinAfterComplete: false
                    productId: "1"
                    variantId: "1"
                }) {
                    id
                    name
                    targetCount
                    groupPrice
                    status
                }
            }
        `);
        expect(result.createGroupBuyActivity).toBeDefined();
        expect(result.createGroupBuyActivity.name).toBe('Test Group Buy');
        expect(result.createGroupBuyActivity.targetCount).toBe(3);
        expect(result.createGroupBuyActivity.status).toBe('active');
    });

    it('can create a FlashSaleActivity', async () => {
        const now = new Date();
        const startAt = new Date(now.getTime() + 3600000);
        const endAt = new Date(now.getTime() + 86400000);
        const result = await adminClient.query(gql`
            mutation {
                createFlashSaleActivity(input: {
                    name: "Test Flash Sale"
                    startAt: "${startAt.toISOString()}"
                    endAt: "${endAt.toISOString()}"
                    flashPrice: 4900
                    totalStock: 100
                    limitPerUser: 1
                    productId: "1"
                    variantId: "1"
                }) {
                    id
                    name
                    flashPrice
                    totalStock
                    status
                }
            }
        `);
        expect(result.createFlashSaleActivity).toBeDefined();
        expect(result.createFlashSaleActivity.name).toBe('Test Flash Sale');
        expect(result.createFlashSaleActivity.flashPrice).toBe(4900);
    });
});
