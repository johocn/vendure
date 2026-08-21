import { Type } from '@nestjs/common';
import { ID } from '@vendure/core';
import { NotifierProvider } from './notifier/notifier-provider';
export interface NotificationPluginOptions {
    /** strapi zhao-sso 基址，如 https://api.example.com。缺省则不投递微信。 */
    strapiBaseUrl?: string;
    /** strapi 管理端 Bearer token。 */
    strapiAdminToken?: string;
    /** scene → strapi msg-template code 映射。 */
    templateSceneMap?: Record<string, string>;
    /** 微信接口化开关，默认 false（未配置不投递）。 */
    wechatEnabled?: boolean;
    /** 微信 HTTP 超时 ms。 */
    httpTimeoutMs?: number;
    /** 自定义 notifier 提供者（测试/扩展用）。覆盖默认微信 notifier。 */
    notifierProvider?: Type<NotifierProvider>;
    /** 站内信总开关，默认 true。 */
    inboxEnabled?: boolean;
}
/** 一次消息触达的统一载荷（编排器产出，notifier 消费）。 */
export interface NotificationFrame {
    scene: string;
    title: string;
    content: string;
    /** 站内信收件人 */
    recipientType: 'customer' | 'admin';
    customerId?: ID;
    administratorId?: ID;
    /** 模板渲染参数（微信） */
    templateParams?: Record<string, any>;
    /** 模板 code（微信，来自 templateSceneMap[scene]） */
    templateCode?: string;
    /** 跳转 link */
    link?: string;
}
export interface InboxMessageListOptions {
    skip?: number;
    take?: number;
}
