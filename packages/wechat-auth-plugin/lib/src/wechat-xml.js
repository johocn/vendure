"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWechatXml = parseWechatXml;
exports.buildTextReplyXml = buildTextReplyXml;
/**
 * 微信回调 XML 扁平解析（值支持 CDATA 与纯文本）。
 * 微信消息 XML 为一层扁平结构（<xml><Tag>value</Tag>...</xml>），
 * 用正则逐标签提取即可，避免引入 xml2js 等第三方依赖。
 */
function parseWechatXml(xml) {
    var _a;
    const result = {};
    if (!xml)
        return result;
    const tagRe = /<([A-Za-z][A-Za-z0-9_]*)>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*?))\s*<\/\1>/g;
    let m;
    while ((m = tagRe.exec(xml)) !== null) {
        const value = m[2] !== undefined ? m[2] : ((_a = m[3]) !== null && _a !== void 0 ? _a : '');
        result[m[1]] = value;
    }
    return result;
}
/**
 * 构造被动回复 XML（UTF-8）。content 为空时返回 'success'（微信约定的空响应）。
 */
function buildTextReplyXml(fromUserName, toUserName, content) {
    if (!content)
        return 'success';
    const cdata = (s) => `<![CDATA[${s}]]>`;
    return ('<xml>' +
        `<ToUserName>${cdata(toUserName)}</ToUserName>` +
        `<FromUserName>${cdata(fromUserName)}</FromUserName>` +
        `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>` +
        '<MsgType><![CDATA[text]]></MsgType>' +
        `<Content>${cdata(content)}</Content>` +
        '</xml>');
}
//# sourceMappingURL=wechat-xml.js.map