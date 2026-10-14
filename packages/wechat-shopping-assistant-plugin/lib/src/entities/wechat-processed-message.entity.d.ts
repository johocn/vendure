import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 已处理的入站消息（MsgId 幂等去重）。
 * 微信回调 5 秒无应答会重试推送，本表防止同一条消息触发两次搜索/下单。
 * 事件类消息无 MsgId，用 from:createTime:event 组合键。
 */
export declare class WechatProcessedMessage extends VendureEntity {
    constructor(input?: DeepPartial<WechatProcessedMessage>);
    /** 去重键：msgId 或 from:createTime:event 组合 */
    dedupKey: string;
    receivedAt: Date;
}
