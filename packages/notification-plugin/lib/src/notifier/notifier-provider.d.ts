import { NotificationFrame } from '../types';
/**
 * 通知通道抽象。站内信为真实落库（不在 provider 内）；本接口专指"外发通道"（微信/sms/企微等）。
 * 默认微信 notifier 调 strapi zhao-sso；未配置时跳过并由编排器降级为"仅站内信"。
 */
export interface NotifierProvider {
    send(frame: NotificationFrame): Promise<boolean>;
}
