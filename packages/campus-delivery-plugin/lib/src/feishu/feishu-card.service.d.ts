import { TransactionalConnection } from '@vendure/core';
import { FeishuClient } from './feishu.client';
import { OrderStatusInput } from './feishu.templates';
/**
 * 订单卡片：数据只从现有 order / campus_building / customer 读，不建表、不落索引。
 * 短码在展示层计算，完整单号只放在按钮 value 里（点击事件原样带回，引用回复也能回读到）。
 */
export declare class FeishuCardService {
    private client;
    private connection;
    /** 同单告警合并缓存：orderCode → { chatId: messageId }。进程内，不持久化 */
    private codeToMessage;
    constructor(client: FeishuClient, connection: TransactionalConnection);
    /** 告警合并入口：pushEvent 带 orderCode 时先尝试 PATCH 卡片追加告警，返回是否成功 */
    appendAlert(orderCode: string, alertText: string): Promise<boolean>;
    /** 读现有表组装卡片所需数据（与文本查单共用同一份视图） */
    loadOrderView(code: string): Promise<OrderStatusInput | null>;
    buildCard(code: string): Promise<Record<string, unknown> | null>;
    /** 发订单卡片，返回 message_id（用于后续原地刷新） */
    sendOrderCard(chatId: string, code: string): Promise<string | null>;
    /** 新订单卡片：发到所有已映射群；一个都没发出去时返回 false，让调用方降级文本 */
    broadcastOrderCard(code: string): Promise<boolean>;
    /** 外部写入 message_id（如用户查单触发 sendOrderCard 后） */
    trackMessage(code: string, chatId: string, messageId: string): void;
    /** 按钮操作后原地刷新卡片（失败不抛错，由调用方决定是否补文本） */
    refresh(messageId: string | undefined, code: string): Promise<boolean>;
}
