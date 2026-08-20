/**
 * 达达开放平台签名（官方新开放平台直连样式，非 key=value& 拼接）。
 * 规则：除 signature 外的参数按 key ASCII 升序，拼接 key1value1key2value2...
 * signature = MD5(app_secret + 拼接串 + app_secret).toUpperCase()
 */
/** 升序拼接出参数字符串（排除 signature 自身） */
export declare function buildParamString(params: Record<string, string | number>): string;
/** 计算签名：MD5(app_secret + paramString + app_secret)，转大写 */
export declare function sign(appSecret: string, paramString: string): string;
export interface DadaSignedParams {
    app_key: string;
    body: string;
    format: string;
    timestamp: string;
    v: string;
    source_id?: string;
    signature: string;
}
/** 生成带签名的达达出站请求参数（body 为业务参数对象，序列化为 JSON 字符串） */
export declare function buildSignedParams(appKey: string, appSecret: string, body: Record<string, unknown>, options?: {
    sourceId?: string;
    timestamp?: number;
}): DadaSignedParams;
/**
 * 校验达达回调签名。
 * 报文为平铺 JSON（app_key/body/format/timestamp/v/source_id/.../signature），
 * 用与出站相同的直连拼接规则，对除 signature 外全部字段验签。
 */
export declare function verifyCallbackSignature(payload: unknown, appSecret: string): boolean;
