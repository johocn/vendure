export interface TcmClinicPluginOptions {
    /** 病志保存年限（门诊病志法定 ≥15 年），默认 15 */
    retentionYears?: number;
    /** AES-256 密钥（64 位 hex）。生产必须提供，缺省回退环境变量 TCM_RECORD_KEY */
    encryptionKey?: string;
    /** zhao-sso 桥接（医生工作台 Admin API 登录）。baseUrl 指向 SSO 中心，策略将 GET {baseUrl}/v1/user/me 校验 accessToken */
    sso?: {
        baseUrl: string;
        /** e2e/本地联调 mock：accessToken 以 mock- 前缀直接构造身份（等价环境变量 SSO_MOCK=true） */
        mock?: boolean;
    };
}
