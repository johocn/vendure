import { FeishuConfigService } from './feishu.config';
/** 自定义群机器人签名：base64(hmac_sha256(key = `${timestamp}\n${secret}`, data = '')) */
export declare function buildWebhookSignature(timestamp: string, secret: string): string;
export declare function buildWebhookPayload(text: string, secret?: string, now?: number): Record<string, unknown>;
/**
 * 飞书发送通道：
 * - 群自定义机器人 webhook（只能发，最简单，用于运维群推送）
 * - 自建应用 bot（tenant_access_token，可定向回复任意已加入的群）
 * 失败只记日志并返回 false，绝不抛到订单主流程。
 */
export declare class FeishuClient {
    private cfg;
    private token?;
    private inflight?;
    constructor(cfg: FeishuConfigService);
    get enabled(): boolean;
    /** 推送到群自定义机器人（or 单群 webhook） */
    sendWebhook(text: string): Promise<boolean>;
    /** 以自建应用身份发到指定群；未配置应用时退回 webhook */
    sendToChat(chatId: string, text: string): Promise<boolean>;
    /** 广播：优先发到所有已映射群；没有群映射时退回 webhook */
    broadcast(text: string): Promise<boolean>;
    /** tenant_access_token 缓存（提前 5 分钟过期），单飞防并发重复取 */
    private tenantToken;
}
