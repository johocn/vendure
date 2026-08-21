import { NotificationPluginOptions, NotificationFrame } from './types';
import { NotifierProvider } from './notifier/notifier-provider';
/**
 * 微信模板消息：调用 strapi zhao-sso admin msg-jobs/anonymous 接口。
 * 契约对齐 strapi/scripts/accept-msg-center.cjs：
 *   POST {base}/api/zhao-sso/v1/admin/msg-jobs/anonymous
 *   body { userId, scene, templateCode, params, link }
 * 未配置基址/token/开关时直接返回 false（仅站内信，不报错）。
 */
export declare class WechatNotifierProvider implements NotifierProvider {
    private options;
    constructor(options: NotificationPluginOptions);
    send(frame: NotificationFrame): Promise<boolean>;
}
