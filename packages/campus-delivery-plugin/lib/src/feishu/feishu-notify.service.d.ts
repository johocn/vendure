import { AdminNotifyEvent } from '@vendure/notification-plugin';
import { FeishuClient } from './feishu.client';
import { FeishuConfigService } from './feishu.config';
/**
 * 管理侧外发：订阅 notification-plugin 的 AdminNotifyEvent，把新订单/售后推到飞书群；
 * 外卖插件内部的异常/超时也走 push() 复用同一条通道。
 * 未启用、未配置、发送失败一律静默降级，绝不阻塞订单主流程。
 */
export declare class FeishuNotifyService {
    private cfg;
    private client;
    private recent;
    constructor(cfg: FeishuConfigService, client: FeishuClient);
    onAdminNotify(event: AdminNotifyEvent): Promise<void>;
    /** 内部事件（异常/超时/支付取消）直接推群；按业务键 5 分钟去重 */
    push(scene: string, dedupeKey: string | undefined, text: string): Promise<void>;
    pushEvent(scene: string, title: string, content: string, orderCode?: string, dedupeKey?: string): Promise<void>;
    private isDuplicate;
}
