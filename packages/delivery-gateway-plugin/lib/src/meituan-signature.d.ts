/**
 * 美团配送开放平台签名（两代并存，联调时用配置切换，不改代码）。
 * - legacy（旧版配送开放平台）：MD5(appkey + timestamp + version + appSecret)
 * - open（新版开放平台/技术服务合作中心）：MD5(`${apiUrl}?${按键名升序的 k=v&...}&appSecret=${appSecret}`)
 */
export type MeituanSignMode = 'legacy' | 'open';
export type MeituanScalar = string | number;
/** 参与签名的标量字段（剔除 sign / 空值 / 对象），键名升序拼成 k=v&... */
export declare function canonicalString(params: Record<string, unknown>): string;
/**
 * 计算美团签名。
 * - legacy：MD5(appkey + timestamp + version + appSecret)
 * - open：MD5(`${apiUrl}?${canonicalString(params)}&appSecret=${appSecret}`)
 */
export declare function buildMeituanSign(params: Record<string, MeituanScalar>, appSecret: string, mode: MeituanSignMode, apiUrl?: string): string;
/** 构造请求参数（body 为业务对象，序列化后参与签名；旧版接口 body 不参与） */
export declare function buildMeituanParams(appKey: string, appSecret: string, mode: MeituanSignMode, body: Record<string, unknown>, timestamp?: number, apiUrl?: string): Record<string, string>;
/** 回调验签：按同一规则重算，签名必须一致；任何异常都返回 false（不得抛出，否则 webhook 会 500） */
export declare function verifyMeituanCallback(payload: Record<string, unknown>, appSecret: string, mode: MeituanSignMode, apiUrl?: string): boolean;
