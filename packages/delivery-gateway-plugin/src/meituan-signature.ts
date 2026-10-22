import { createHash } from 'crypto';

/**
 * 美团配送开放平台签名（两代并存，联调时用配置切换，不改代码）。
 * - legacy（旧版配送开放平台）：MD5(appkey + timestamp + version + appSecret)
 * - open（新版开放平台/技术服务合作中心）：MD5(`${apiUrl}?${按键名升序的 k=v&...}&appSecret=${appSecret}`)
 */

export type MeituanSignMode = 'legacy' | 'open';

export type MeituanScalar = string | number;

/** 参与签名的标量字段（剔除 sign / 空值 / 对象），键名升序拼成 k=v&... */
export function canonicalString(params: Record<string, unknown>): string {
    return Object.keys(params)
        .filter(k => k !== 'sign')
        .filter(k => {
            const v = params[k];
            return v !== undefined && v !== null && v !== '' && typeof v !== 'object';
        })
        .sort()
        .map(k => `${k}=${String(params[k])}`)
        .join('&');
}

function md5(input: string): string {
    return createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * 计算美团签名。
 * - legacy：MD5(appkey + timestamp + version + appSecret)
 * - open：MD5(`${apiUrl}?${canonicalString(params)}&appSecret=${appSecret}`)
 */
export function buildMeituanSign(
    params: Record<string, MeituanScalar>,
    appSecret: string,
    mode: MeituanSignMode,
    apiUrl = '',
): string {
    if (mode === 'legacy') {
        return md5(`${params.appkey}${params.timestamp}${params.version}${appSecret}`);
    }
    if (!apiUrl) {
        throw new Error('meituan open 签名模式必须提供 apiUrl');
    }
    return md5(`${apiUrl}?${canonicalString(params)}&appSecret=${appSecret}`);
}

/** 构造请求参数（body 为业务对象，序列化后参与签名；旧版接口 body 不参与） */
export function buildMeituanParams(
    appKey: string,
    appSecret: string,
    mode: MeituanSignMode,
    body: Record<string, unknown>,
    timestamp = Math.floor(Date.now() / 1000),
    apiUrl = '',
): Record<string, string> {
    const params: Record<string, string> = {
        appkey: appKey,
        timestamp: String(timestamp),
        version: '1.0',
        body: JSON.stringify(body),
    };
    const signSource =
        mode === 'legacy' ? { appkey: params.appkey, timestamp: params.timestamp, version: params.version } : params;
    return { ...params, sign: buildMeituanSign(signSource, appSecret, mode, apiUrl) };
}

/** 回调验签：按同一规则重算，签名必须一致；任何异常都返回 false（不得抛出，否则 webhook 会 500） */
export function verifyMeituanCallback(
    payload: Record<string, unknown>,
    appSecret: string,
    mode: MeituanSignMode,
    apiUrl = '',
): boolean {
    const sign = typeof payload.sign === 'string' ? payload.sign : '';
    if (!sign) return false;
    const { sign: _ignored, ...rest } = payload;
    try {
        return buildMeituanSign(rest as Record<string, MeituanScalar>, appSecret, mode, apiUrl) === sign;
    } catch {
        return false;
    }
}
