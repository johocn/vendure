import { VendureEvent } from '@vendure/core';
/**
 * 公众号回调消息（已解密/解析后的扁平字段）。
 * 文本消息含 content；事件消息含 event/eventKey；位置消息含经纬度与地址描述。
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
    /** 位置消息：纬度（GCJ-02，微信原生坐标系） */
    latitude?: number;
    /** 位置消息：经度（GCJ-02） */
    longitude?: number;
    /** 位置消息：地图缩放级别（非定位精度） */
    scale?: number;
    /** 位置消息：用户上报的地址描述文本 */
    label?: string;
}
export declare class WechatMessageEvent extends VendureEvent {
    message: WechatInboundMessage;
    constructor(message: WechatInboundMessage);
}
