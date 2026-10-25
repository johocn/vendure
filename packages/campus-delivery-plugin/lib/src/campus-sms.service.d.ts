/**
 * 短信兜底适配器（通知第 2 通道）。
 * 只在环境变量齐全时启用：SMS_GATEWAY_URL / SMS_GATEWAY_KEY；未配置即静默 no-op，
 * 不伪造发送成功、不阻塞业务主流程（公众号模板消息仍是第 1 通道）。
 * 网关契约：POST {SMS_GATEWAY_URL}，Header Authorization: Bearer {key}，
 * body { phone, content, signName }；2xx 视为发送成功。
 */
export declare class CampusSmsService {
    private readonly loggerCtx;
    private readonly timeoutMs;
    get configured(): boolean;
    send(phone: string | null | undefined, content: string): Promise<boolean>;
}
