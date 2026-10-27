export interface UnmannedProviderOption {
    code: string;
    name: string;
    /** 是否需要填接口地址（自建/平台中转才需要） */
    needsEndpoint: boolean;
    /** 是否需要填密钥 */
    needsKey: boolean;
}
export declare const UNMANNED_PROVIDERS: UnmannedProviderOption[];
export declare function findUnmannedProvider(code: string): UnmannedProviderOption;
export interface UnmannedDeliveryResult {
    ok: boolean;
    provider: string;
    providerName: string;
    /** disabled=通道未开启 / unconfigured=缺接口地址或密钥 / rejected=厂商未受理 / accepted=已受理 */
    status: 'disabled' | 'unconfigured' | 'rejected' | 'accepted';
    requestNo: string | null;
    message: string;
}
