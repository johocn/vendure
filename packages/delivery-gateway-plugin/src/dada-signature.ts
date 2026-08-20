import { createHash } from 'crypto';

/**
 * 达达开放平台签名（官方新开放平台直连样式，非 key=value& 拼接）。
 * 规则：除 signature 外的参数按 key ASCII 升序，拼接 key1value1key2value2...
 * signature = MD5(app_secret + 拼接串 + app_secret).toUpperCase()
 */

/** 升序拼接出参数字符串（排除 signature 自身） */
export function buildParamString(params: Record<string, string | number>): string {
    return Object.keys(params)
        .filter(k => k !== 'signature')
        .sort()
        .map(k => `${k}${params[k]}`)
        .join('');
}

/** 计算签名：MD5(app_secret + paramString + app_secret)，转大写 */
export function sign(appSecret: string, paramString: string): string {
    return createHash('md5')
        .update(`${appSecret}${paramString}${appSecret}`, 'utf8')
        .digest('hex')
        .toUpperCase();
}

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
export function buildSignedParams(
    appKey: string,
    appSecret: string,
    body: Record<string, unknown>,
    options?: { sourceId?: string; timestamp?: number },
): DadaSignedParams {
    const params: Record<string, string> = {
        app_key: appKey,
        body: JSON.stringify(body),
        format: 'json',
        timestamp: String(options?.timestamp ?? Math.floor(Date.now() / 1000)),
        v: '1.0',
    };
    if (options?.sourceId) {
        params.source_id = options.sourceId;
    }
    const signature = sign(appSecret, buildParamString(params));
    return {
        app_key: params.app_key,
        body: params.body,
        format: params.format,
        timestamp: params.timestamp,
        v: params.v,
        ...(params.source_id ? { source_id: params.source_id } : {}),
        signature,
    };
}

/**
 * 校验达达回调签名。
 * 报文为平铺 JSON（app_key/body/format/timestamp/v/source_id/.../signature），
 * 用与出站相同的直连拼接规则，对除 signature 外全部字段验签。
 */
export function verifyCallbackSignature(payload: unknown, appSecret: string): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const record = payload as Record<string, unknown>;
    const signature = record.signature;
    if (typeof signature !== 'string' || !signature) {
        return false;
    }
    const fields: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(record)) {
        if (k === 'signature') {
            continue;
        }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            fields[k] = String(v);
        }
    }
    return sign(appSecret, buildParamString(fields)) === signature.toUpperCase();
}
