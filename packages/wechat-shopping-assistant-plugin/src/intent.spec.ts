import { describe, expect, test } from 'vitest';
import { buildDedupKey, normalizeInput, parseOrderIndices, recognizeIntent } from './intent';

describe('normalizeInput', () => {
    test('converts full-width chars and trims spaces', () => {
        expect(normalizeInput('　买 １２３　')).toBe('买123');
    });
});

describe('parseOrderIndices', () => {
    test('single and multiple indices', () => {
        expect(parseOrderIndices('1')).toEqual([1]);
        expect(parseOrderIndices('1,3')).toEqual([1, 3]);
        expect(parseOrderIndices('1和3')).toEqual([1, 3]);
    });
    test('rejects invalid parts', () => {
        expect(parseOrderIndices('a')).toBeNull();
        expect(parseOrderIndices('0')).toBeNull();
        expect(parseOrderIndices('1,x')).toBeNull();
    });
});

describe('recognizeIntent', () => {
    test('search with natural language', () => {
        expect(recognizeIntent('买一瓶酱油')).toEqual({ kind: 'search', query: '一瓶酱油' });
        expect(recognizeIntent('想要洗衣液')).toEqual({ kind: 'search', query: '洗衣液' });
        expect(recognizeIntent('大米')).toEqual({ kind: 'search', query: '大米' });
    });

    test('search with quantity', () => {
        expect(recognizeIntent('买2瓶酱油')).toEqual({ kind: 'search', query: '酱油', quantity: 2 });
        expect(recognizeIntent('来3袋盐')).toEqual({ kind: 'search', query: '盐', quantity: 3 });
    });

    test('order by indices', () => {
        expect(recognizeIntent('买1')).toEqual({ kind: 'order', indices: [1] });
        expect(recognizeIntent('1')).toEqual({ kind: 'order', indices: [1] });
        expect(recognizeIntent('买1和3')).toEqual({ kind: 'order', indices: [1, 3] });
        expect(recognizeIntent('下单 2')).toEqual({ kind: 'order', indices: [2] });
    });

    test('help and bind', () => {
        expect(recognizeIntent('帮助')).toEqual({ kind: 'help' });
        expect(recognizeIntent('你好')).toEqual({ kind: 'help' });
        expect(recognizeIntent('绑定')).toEqual({ kind: 'bind' });
        expect(recognizeIntent('怎么登录账号')).toEqual({ kind: 'search', query: '怎么登录账号' });
    });

    test('full-width digits order', () => {
        expect(recognizeIntent('买２')).toEqual({ kind: 'order', indices: [2] });
    });

    test('address manage intents', () => {
        expect(recognizeIntent('地址管理')).toEqual({ kind: 'address_manage' });
        expect(recognizeIntent('我的地址')).toEqual({ kind: 'address_manage' });
        expect(recognizeIntent('地址簿')).toEqual({ kind: 'address_manage' });
        expect(recognizeIntent('收货地址！')).toEqual({ kind: 'address_manage' });
    });

    test('address add intents', () => {
        expect(recognizeIntent('新增地址')).toEqual({ kind: 'address_add' });
        expect(recognizeIntent('添加地址。')).toEqual({ kind: 'address_add' });
        expect(recognizeIntent('新增')).toEqual({ kind: 'address_add' });
    });

    test('support intents（全局指令）', () => {
        expect(recognizeIntent('客服')).toEqual({ kind: 'support' });
        expect(recognizeIntent('人工')).toEqual({ kind: 'support' });
        expect(recognizeIntent('转人工！')).toEqual({ kind: 'support' });
        expect(recognizeIntent('投诉')).toEqual({ kind: 'support' });
        expect(recognizeIntent('客服2')).toEqual({ kind: 'support', storeIndex: 2 });
        expect(recognizeIntent('客服 ３')).toEqual({ kind: 'support', storeIndex: 3 });
        // 不是纯客服指令时仍走搜索
        expect(recognizeIntent('客服电话是多少')).toEqual({ kind: 'search', query: '客服电话是多少' });
    });
});

describe('buildDedupKey', () => {
    test('prefers MsgId', () => {
        expect(buildDedupKey({ msgId: '123', fromUserName: 'oX', msgType: 'text' })).toBe('mid:123');
    });
    test('falls back to composite key for events', () => {
        expect(buildDedupKey({ fromUserName: 'oX', createTime: 111, event: 'subscribe', msgType: 'event' })).toBe(
            'evt:oX:111:subscribe',
        );
    });
});
