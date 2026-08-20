/** 出站 HTTP 适配器抽象：测试可注入 fake，生产用 fetch 实现 */
export interface DadaHttpAdapter {
    post(path: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}
/** 基于 fetch 的实现：POST application/json 到 baseUrl+path */
export declare class FetchDadaHttpAdapter implements DadaHttpAdapter {
    private readonly baseUrl;
    constructor(baseUrl: string);
    post(path: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}
