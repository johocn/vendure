import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import { NOTIFICATION_PLUGIN_OPTIONS } from './constants';
import { loggerCtx } from './constants';
import { NotificationPluginOptions, NotificationFrame } from './types';
import { NotifierProvider } from './notifier/notifier-provider';

/**
 * 微信模板消息：调用 strapi zhao-sso admin msg-jobs/anonymous 接口。
 * 契约对齐 strapi/scripts/accept-msg-center.cjs：
 *   POST {base}/api/zhao-sso/v1/admin/msg-jobs/anonymous
 *   body { userId, scene, templateCode, params, link }
 * 未配置基址/token/开关时直接返回 false（仅站内信，不报错）。
 */
@Injectable()
export class WechatNotifierProvider implements NotifierProvider {
    constructor(@Inject(NOTIFICATION_PLUGIN_OPTIONS) private options: NotificationPluginOptions) {}

    async send(frame: NotificationFrame): Promise<boolean> {
        const { strapiBaseUrl, strapiAdminToken, wechatEnabled, templateSceneMap, httpTimeoutMs } = this.options;
        if (!wechatEnabled || !strapiBaseUrl || !strapiAdminToken) {
            return false;
        }
        const templateCode = frame.templateCode ?? templateSceneMap?.[frame.scene];
        if (!templateCode || frame.recipientType !== 'customer' || !frame.customerId) {
            return false;
        }
        try {
            const full = `${strapiBaseUrl.replace(/\/$/, '')}/api/zhao-sso/v1/admin/msg-jobs/anonymous`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), httpTimeoutMs ?? 5000);
            const res = await fetch(full, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strapiAdminToken}` },
                signal: ctrl.signal,
                body: JSON.stringify({
                    userId: Number(frame.customerId),
                    scene: frame.scene,
                    templateCode,
                    params: frame.templateParams ?? {},
                    ...(frame.link ? { link: frame.link } : {}),
                }),
            });
            clearTimeout(t);
            if (!res.ok) {
                Logger.warn(`wechat send http ${res.status} scene=${frame.scene}`, loggerCtx);
                return false;
            }
            Logger.verbose(`wechat send ok scene=${frame.scene}`, loggerCtx);
            return true;
        } catch (e: any) {
            Logger.warn(`wechat send failed: ${e?.message}`, loggerCtx);
            return false;
        }
    }
}