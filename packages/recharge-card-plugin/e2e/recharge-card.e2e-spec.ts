import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { RechargeCardPlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('RechargeCardPlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [RechargeCardPlugin.init()],
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

    it('exposes rechargeCards admin query', async () => {
        const result = await adminClient.query(gql`
            query { rechargeCards { items { id code faceValue state } totalItems } }
        `);
        expect(result.rechargeCards).toBeDefined();
        expect(result.rechargeCards.items).toEqual([]);
        expect(result.rechargeCards.totalItems).toBe(0);
    });

    it('exposes rechargeCardBatches admin query', async () => {
        const result = await adminClient.query(gql`
            query { rechargeCardBatches { items { id name prefix faceValue quantity generatedCount } totalItems } }
        `);
        expect(result.rechargeCardBatches).toBeDefined();
        expect(result.rechargeCardBatches.items).toEqual([]);
        expect(result.rechargeCardBatches.totalItems).toBe(0);
    });
});
