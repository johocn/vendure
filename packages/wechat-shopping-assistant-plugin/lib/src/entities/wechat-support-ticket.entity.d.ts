import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 微信购物助手「留言」工单（PRD FR-07）：
 * 用户在任何一步回复「留言」→ 写下问题 → 落库；门店/平台在后台回复后经公众号会话下发。
 * 会话状态与工单解耦：工单保存后原状态机照常恢复。
 */
export declare class WechatSupportTicket extends VendureEntity {
    constructor(input?: DeepPartial<WechatSupportTicket>);
    /** 留言用户 openid（回复时经客服消息下发到这个用户） */
    openid: string;
    channelId: number | null;
    customerId: number | null;
    /** 关联门店 id（用户已选门店/3km 唯一候选时） */
    storeId: string | null;
    /** 门店名快照（后台列表直接展示，门店改名后仍可追溯） */
    storeName: string | null;
    /** 下单上下文摘要（商品/金额/城市等，便于客服定位问题） */
    summary: string | null;
    /** 留言正文（≤200 字） */
    content: string;
    /** open | replied */
    status: string;
    /** 后台回复内容（下发后保存） */
    reply: string | null;
    repliedAt: Date | null;
}
