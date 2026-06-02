import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { DistributionPlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('DistributionPlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [DistributionPlugin.init({
                defaultDirectRate: 1000,
                defaultIndirectRate: 500,
                minWithdrawalAmount: 10000,
                settlementDays: 7,
            })],
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('plugin loads without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('registers distributionEnabled custom field on Channel', async () => {
        const result = await adminClient.query(gql`
            query { channel(id: "1") { id customFields { distributionEnabled directCommissionRate indirectCommissionRate } } }
        `);
        expect(result.channel.customFields.distributionEnabled).toBe(false);
        expect(result.channel.customFields.directCommissionRate).toBe(1000);
    });

    it('exposes distributors admin query', async () => {
        const result = await adminClient.query(gql`
            query { distributors(options: { take: 10 }) { items { id referralCode status } totalItems } }
        `);
        expect(result.distributors).toBeDefined();
        expect(result.distributors.items).toEqual([]);
    });
});
