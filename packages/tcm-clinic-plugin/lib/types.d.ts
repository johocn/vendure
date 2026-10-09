export interface TcmClinicPluginOptions {
    /** 病志保存年限（门诊病志法定 ≥15 年），默认 15 */
    retentionYears?: number;
    /** AES-256 密钥（64 位 hex）。生产必须提供，缺省回退环境变量 TCM_RECORD_KEY */
    encryptionKey?: string;
}
