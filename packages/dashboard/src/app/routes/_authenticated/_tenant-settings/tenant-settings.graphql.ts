// 插件新增的 tenantSettings/updateTenantBasic 等不在 GraphQL Codegen 生成类型里，
// 因此这里用纯字符串文档，配合 api.query(stringDoc, vars) / api.mutate(stringDoc, vars) 调用。
export const tenantSettingsDocument = `
    query GetTenantSettings($channelId: ID!) {
        tenantSettings(channelId: $channelId) {
            channelId
            basic
            auth
            pay
            map
            serviceNotify
            multiLanguage
            canEdit
        }
    }
`;

export const updateTenantBasicDocument = `
    mutation UpdateTenantBasic($input: TenantSectionPatchInput!) {
        updateTenantBasic(input: $input) {
            channelId
            basic
        }
    }
`;

export const updateTenantMultiLanguageDocument = `
    mutation UpdateTenantMultiLanguage($input: TenantSectionPatchInput!) {
        updateTenantMultiLanguage(input: $input) {
            channelId
            multiLanguage
        }
    }
`;

export const updateTenantServiceNotifyDocument = `
    mutation UpdateTenantServiceNotify($input: TenantSectionPatchInput!) {
        updateTenantServiceNotify(input: $input) {
            channelId
            serviceNotify
        }
    }
`;

export const updateTenantConfigDocument = `
    mutation UpdateTenantConfig($input: UpdateTenantConfigInput!) {
        updateTenantConfig(input: $input) {
            channelId
            auth
            pay
            map
            canEdit
        }
    }
`;