/**
 * 微信回调 XML 扁平解析（值支持 CDATA 与纯文本）。
 * 微信消息 XML 为一层扁平结构（<xml><Tag>value</Tag>...</xml>），
 * 用正则逐标签提取即可，避免引入 xml2js 等第三方依赖。
 */
export declare function parseWechatXml(xml: string): Record<string, string>;
/**
 * 构造被动回复 XML（UTF-8）。content 为空时返回 'success'（微信约定的空响应）。
 */
export declare function buildTextReplyXml(fromUserName: string, toUserName: string, content: string): string;
