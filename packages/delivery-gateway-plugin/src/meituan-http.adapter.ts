import { Logger } from '@vendure/core';
import { buildMeituanParams, MeituanSignMode } from './meituan-signature';
import { loggerCtx } from './constants';

export interface MeituanHttpConfig {
    appKey: string;
    appSecret: string;
    signMode: MeituanSignMode;
    baseUrl?: string;
    timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://peisongopen.meituan.com';
const DEFAULT_TIMEOUT = 8000;

/** 美团开放平台 HTTP：application/x-www-form-urlencoded，统一错误归一 */
export class MeituanHttpAdapter {
    constructor(private config: MeituanHttpConfig) {}

    private get baseUrl(): string {
        return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    }

    async post<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
        const apiUrl = `${this.baseUrl}${path}`;
        const params = buildMeituanParams(
            this.config.appKey,
            this.config.appSecret,
            this.config.signMode,
            body,
            Math.floor(Date.now() / 1000),
            apiUrl,
        );
        const form = new URLSearchParams(params);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT);
        let res: Response;
        try {
            res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
                signal: ctrl.signal,
            });
        } catch (e: any) {
            Logger.warn(`美团请求失败 ${path}: ${e?.message ?? e}`, loggerCtx);
            throw e;
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) {
            throw new Error(`美团 HTTP ${res.status} ${path}`);
        }
        const json = (await res.json()) as any;
        // 兼容 data.code / code 两种返回包裹
        const code = Number(json?.code ?? json?.data?.code ?? 0);
        if (code !== 0) {
            throw new Error(`美团业务错误 ${code}: ${json?.msg ?? json?.data?.message ?? 'unknown'}`);
        }
        return (json?.data ?? json) as T;
    }
}
