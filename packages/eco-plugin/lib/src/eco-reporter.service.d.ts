import { EcoAction, EcoPluginOptions } from './types';
export interface EcoReportBody {
    action: string;
    scope: string;
    ssoId: string;
    targetId: string;
    extra?: Record<string, any>;
}
/**
 * 生态行为上报器（三处复用：purchase / distribute / view_product|view_price 转发端点）。
 * 契约（与游戏服务器 eco-events 服务对齐）：
 * - POST {gameUrl}/api/client/v1/eco/events
 * - 请求头：X-Eco-Sign = hex(hmac_sha256(secret, rawBody + "|" + timestamp))、X-Eco-Ts = unix 秒
 * - 服务端用 req.rawBody 原文验签，因此发送体与签名体必须是同一字符串（固定键序 JSON.stringify）
 * fire-and-forget：2s 超时 + 失败仅 console.warn，绝不抛出、绝不影响主流程。
 */
export declare class EcoReporter {
    private options;
    constructor(options: EcoPluginOptions);
    private get gameUrl();
    private get secret();
    /**
     * 上报一个生态行为（fire-and-forget）。ssoId 取不到或未配置 URL/密钥时静默跳过。
     */
    report(ssoId: string | undefined, action: EcoAction, targetId: string, extra?: Record<string, any>): void;
    private post;
}
