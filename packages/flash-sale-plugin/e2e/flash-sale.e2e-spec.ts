import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { FlashSalePlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('FlashSalePlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [FlashSalePlugin.init({ defaultTimeoutMinutes: 15 })],
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

    it('exposes flashSaleActivities admin query', async () => {
        const result = await adminClient.query(gql`
            query { flashSaleActivities(options: { take: 10 }) { items { id name status } totalItems } }
        `);
        expect(result.flashSaleActivities).toBeDefined();
        expect(result.flashSaleActivities.items).toEqual([]);
    });

    it('exposes activeFlashSaleActivities shop query', async () => {
        const result = await shopClient.query(gql`
            query { activeFlashSaleActivities { id name } }
        `);
        expect(result.activeFlashSaleActivities).toEqual([]);
    });
});
