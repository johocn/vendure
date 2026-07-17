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
            plugins: [
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

    it('exposes distributors admin query', async () => {
        const result = await adminClient.query(gql`
            query { distributors { items { id customerId level status referralCode } totalItems } }
        `);
        expect(result.distributors).toBeDefined();
        expect(result.distributors.items).toEqual([]);
        expect(result.distributors.totalItems).toBe(0);
    });

    it('exposes commissionRecords admin query', async () => {
        const result = await adminClient.query(gql`
            query { commissionRecords { items { id distributorId orderId commissionType commissionAmount status } totalItems } }
        `);
        expect(result.commissionRecords).toBeDefined();
        expect(result.commissionRecords.items).toEqual([]);
        expect(result.commissionRecords.totalItems).toBe(0);
    });

    it('exposes withdrawalRequests admin query', async () => {
        const result = await adminClient.query(gql`
            query { withdrawalRequests { items { id distributorId amount method status } totalItems } }
        `);
        expect(result.withdrawalRequests).toBeDefined();
        expect(result.withdrawalRequests.items).toEqual([]);
        expect(result.withdrawalRequests.totalItems).toBe(0);
    });
});
