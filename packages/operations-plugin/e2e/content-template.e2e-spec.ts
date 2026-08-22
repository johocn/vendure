import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { OperationsPlugin } from '../src/operations.plugin';
import { deliveryPermissionDefinitions } from '../../delivery-plugin/src/constants';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('OperationsPlugin · ContentType 校验（IconGrid/CategoryNav）', () => {
    const { server, adminClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [OperationsPlugin.init()],
            authOptions: { customPermissions: deliveryPermissionDefinitions },
        }),
    );

    beforeAll(async () => {
        await server.init({ initialData });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('rejects IconGrid with empty data.items', async () => {
        await expect(
            adminClient.query(gql`
                mutation {
                    createContentItem(input: { type: "IconGrid", code: "ig1", name: "IG", data: {} }) { id }
                }
            `),
        ).rejects.toThrow();
    });

    it('accepts IconGrid with valid items', async () => {
        const res = await adminClient.query(gql`
            mutation {
                createContentItem(input: {
                    type: "IconGrid", code: "ig2", name: "IG", position: "home", sort: 1,
                    data: { items: [ { icon: "i-solar:home-2-bold-duotone", label: "首页", link: "/" } ] }
                }) { id type }
            }
        `) as any;
        expect(res.createContentItem.type).toBe('IconGrid');
    });
});