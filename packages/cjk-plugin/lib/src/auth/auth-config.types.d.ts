export type AuthMethod = 'native' | 'phone' | 'wechat' | 'alipay' | 'douyin' | 'sso';
export interface TenantAuthConfig {
    enabledMethods: AuthMethod[];
    overrides?: Partial<{
        phone: {
            accessKeyId: string;
            accessKeySecret: string;
            signName: string;
            templateCode: string;
        };
        wechat: {
            appId: string;
            appSecret: string;
            miniProgramAppId?: string;
            miniProgramAppSecret?: string;
            token?: string;
            encodingAESKey?: string;
        };
        alipay: {
            appId: string;
            privateKey: string;
            miniProgramAppId?: string;
        };
        douyin: {
            appId: string;
            appSecret: string;
            miniProgramAppId?: string;
            miniProgramAppSecret?: string;
        };
    }>;
    ssoProviders?: SsoProvider[];
}
export interface SsoProvider {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    channelCode?: string;
    userInfoMapping?: {
        externalIdField?: string;
        emailField?: string;
        nicknameField?: string;
        mobileField?: string;
        avatarField?: string;
    };
}
/** 管理后台返回的脱敏结构 */
export interface TenantAuthConfigMasked {
    enabledMethods: AuthMethod[];
    overrides?: Record<string, any>;
    ssoProviders?: SsoProviderMasked[];
}
export interface SsoProviderMasked {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    channelCode?: string;
    userInfoMapping?: SsoProvider['userInfoMapping'];
}
/** Shop API 返回的精简结构（不含 secret） */
export interface SsoProviderInfo {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    clientId: string;
    scopes: string[];
    channelCode?: string;
}
