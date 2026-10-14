import { VendureEvent } from '@vendure/core';

/**
 * 公众号回调消息（已解密/解析后的扁平字段）。
 * 文本消息含 content；事件消息含 event/eventKey；媒体消息不含可用文本。
 */
export interface WechatInboundMessage {
    /** 回调 URL 的 channel 查询参数（租户渠道 token） */
    channelToken: string;
    msgType: string;
    /** 用户 openid */
    fromUserName: string;
    /** 公众号原始 ID */
    toUserName: string;
    content?: string;
    msgId?: string;
    event?: string;
    eventKey?: string;
    createTime?: number;
}

export class WechatMessageEvent extends VendureEvent {
    constructor(public message: WechatInboundMessage) {
        super();
    }
}
