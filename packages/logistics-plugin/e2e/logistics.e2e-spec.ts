import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { LogisticsPlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('LogisticsPlugin', () => {
    const { server, adminClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [LogisticsPlugin.init()],
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

    it('registers shippingStrategy custom field on Channel', async () => {
        const result = await adminClient.query(gql`
            query { channel(id: "1") { id customFields { shippingStrategy stockLocationPriority } } }
        `);
        expect(result.channel.customFields.shippingStrategy).toBe('priority');
    });
});
