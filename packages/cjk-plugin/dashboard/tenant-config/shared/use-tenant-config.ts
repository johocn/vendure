import { useMutation, useQuery } from '@tanstack/react-query';
import { api, graphql } from '@vendure/dashboard';

const TENANT_CONFIG_QUERY = graphql(`
    query TenantConfig($channelId: ID!) {
        tenantConfig(channelId: $channelId) {
            channelId
            auth
            pay
            map
            canEdit
        }
    }
`);

const UPDATE_TENANT_CONFIG = graphql(`
    mutation UpdateTenantConfig($input: UpdateTenantConfigInput!) {
        updateTenantConfig(input: $input) {
            channelId
            auth
            pay
            map
            canEdit
        }
    }
`);

const TEST_SSO = graphql(`
    mutation TestSso($input: TestSsoInput!) {
        testSsoConnection(input: $input) {
            success
            latencyMs
            error
        }
    }
`);

export function useTenantConfig(channelId: string) {
    const query = useQuery({
        queryKey: ['tenantConfig', channelId],
        queryFn: () => api.query(TENANT_CONFIG_QUERY, { channelId }),
    });
    const updateMutation = useMutation({
        mutationFn: (patch: any) => api.mutate(UPDATE_TENANT_CONFIG, { input: { channelId, ...patch } }),
    });
    const testSsoMutation = useMutation({
        mutationFn: (vars: { providerKey: string; newClientSecret?: string }) =>
            api.mutate(TEST_SSO, { input: { channelId, ...vars } }),
    });
    return {
        data: query.data?.tenantConfig,
        loading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        update: (patch: any) => updateMutation.mutateAsync(patch),
        testSso: (providerKey: string, newClientSecret?: string) =>
            testSsoMutation.mutateAsync({ providerKey, newClientSecret }),
    };
}
