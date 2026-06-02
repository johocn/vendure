import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { GroupBuyPlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('GroupBuyPlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 })],
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

    it('exposes groupBuyActivities admin query', async () => {
        const result = await adminClient.query(gql`
            query { groupBuyActivities(options: { take: 10 }) { items { id name status } totalItems } }
        `);
        expect(result.groupBuyActivities).toBeDefined();
        expect(result.groupBuyActivities.items).toEqual([]);
    });

    it('exposes activeGroupBuyActivities shop query', async () => {
        const result = await shopClient.query(gql`
            query { activeGroupBuyActivities { id name } }
        `);
        expect(result.activeGroupBuyActivities).toEqual([]);
    });
});
