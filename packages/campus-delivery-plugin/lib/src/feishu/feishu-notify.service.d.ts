import { AdminNotifyEvent } from '@vendure/notification-plugin';
import { FeishuCardService } from './feishu-card.service';
import { FeishuClient } from './feishu.client';
/**
 * 管理侧外发：订阅 notification-plugin 的 AdminNotifyEvent，把新订单/售后推到飞书群；
 * 新订单优先发订单卡片（尾号 + 按钮 + 话题归集），卡片失败再降级为文本；
 * 外卖插件内部的异常/超时也走 push() 复用同一条通道。
 * 未启用、未配置、发送失败一律静默降级，绝不阻塞订单主流程。
 */
export declare class FeishuNotifyService {
    private client;
    private cards;
    private recent;
    constructor(client: FeishuClient, cards: FeishuCardService);
    onAdminNotify(event: AdminNotifyEvent): Promise<void>;
    /** 内部事件（异常/超时/支付取消）直接推群；按业务键 2 分钟去重。
     * 返回是否送达（未启用/去重命中记为 true，避免调用方无意义重试）。 */
    push(scene: string, dedupeKey: string | undefined, text: string): Promise<boolean>;
    /** 返回是否已送达/已合并到卡片：false 表示本次推送失败，调用方应保留重试机会。 */
    pushEvent(scene: string, title: string, content: string, orderCode?: string, dedupeKey?: string): Promise<boolean>;
    private deliver;
    /** 送达成功后才登记去重键：发送失败不应占用去重窗口，否则失败一次会静默整整一个窗口。 */
    private mark;
    private isDuplicate;
}
