import { describe, expect, test } from 'vitest';
import { buildTextReplyXml, parseWechatXml } from '../src/wechat-xml';

describe('parseWechatXml', () => {
    test('parses CDATA values from a text message', () => {
        const xml = `<xml><ToUserName><![CDATA[gh_1234]]></ToUserName>
<FromUserName><![CDATA[oX8abcd]]></FromUserName>
<CreateTime>1728777600</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[买一瓶酱油]]></Content>
<MsgId>23848821830001234</MsgId></xml>`;
        const parsed = parseWechatXml(xml);
        expect(parsed.ToUserName).toBe('gh_1234');
        expect(parsed.FromUserName).toBe('oX8abcd');
        expect(parsed.MsgType).toBe('text');
        expect(parsed.Content).toBe('买一瓶酱油');
        expect(parsed.MsgId).toBe('23848821830001234');
    });

    test('parses plain (non-CDATA) values', () => {
        const parsed = parseWechatXml('<xml><CreateTime>123</CreateTime><MsgId>456</MsgId></xml>');
        expect(parsed.CreateTime).toBe('123');
        expect(parsed.MsgId).toBe('456');
    });

    test('parses encrypted envelope', () => {
        const xml = '<xml><ToUserName><![CDATA[gh_x]]></ToUserName><Encrypt><![CDATA[BASE64==]]></Encrypt></xml>';
        expect(parseWechatXml(xml).Encrypt).toBe('BASE64==');
    });

    test('returns empty object for empty input', () => {
        expect(parseWechatXml('')).toEqual({});
        expect(parseWechatXml('not xml')).toEqual({});
    });

    test('handles values containing special xml-unfriendly chars inside CDATA', () => {
        const parsed = parseWechatXml('<xml><Content><![CDATA[a<b>c & d]]></Content></xml>');
        expect(parsed.Content).toBe('a<b>c & d');
    });
});

describe('buildTextReplyXml', () => {
    test('builds passive text reply', () => {
        const xml = buildTextReplyXml('gh_x', 'oY', '你好');
        expect(xml).toContain('<ToUserName><![CDATA[oY]]></ToUserName>');
        expect(xml).toContain('<FromUserName><![CDATA[gh_x]]></FromUserName>');
        expect(xml).toContain('<Content><![CDATA[你好]]></Content>');
        expect(xml).toContain('<MsgType><![CDATA[text]]></MsgType>');
    });

    test('returns success for empty content', () => {
        expect(buildTextReplyXml('gh_x', 'oY', '')).toBe('success');
    });
});
