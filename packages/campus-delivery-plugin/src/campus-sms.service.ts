import { Injectable, Logger } from '@nestjs/common';

/**
 * 短信兜底适配器（通知第 2 通道）。
 * 只在环境变量齐全时启用：SMS_GATEWAY_URL / SMS_GATEWAY_KEY；未配置即静默 no-op，
 * 不伪造发送成功、不阻塞业务主流程（公众号模板消息仍是第 1 通道）。
 * 网关契约：POST {SMS_GATEWAY_URL}，Header Authorization: Bearer {key}，
 * body { phone, content, signName }；2xx 视为发送成功。
 */
@Injectable()
export class CampusSmsService {
    private readonly loggerCtx = 'CampusSms';
    private readonly timeoutMs = 8_000;

    get configured(): boolean {
        return Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_KEY);
    }

    async send(phone: string | null | undefined, content: string): Promise<boolean> {
        if (!this.configured) return false;
        const normalized = String(phone ?? '').replace(/[^\d+]/g, '');
        if (!normalized) return false;
        try {
            const res = await fetch(String(process.env.SMS_GATEWAY_URL), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.SMS_GATEWAY_KEY}`,
                },
                body: JSON.stringify({
                    phone: normalized,
                    content,
                    signName: process.env.SMS_SIGN_NAME ?? '',
                }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                Logger.warn(`sms gateway ${res.status}: ${body.slice(0, 200)}`, this.loggerCtx);
                return false;
            }
            return true;
        } catch (e: any) {
            Logger.warn(`sms send failed: ${e?.message ?? e}`, this.loggerCtx);
            return false;
        }
    }
}
