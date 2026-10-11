// P4 Task 14 取消报价纯函数单测：免费窗口 / 逾时扣首晚 / 扣全款 / 不可退 / 无政策 / 未付款 / 边界
import { describe, expect, it } from 'vitest';

import { computeCancelQuote, type CancelQuoteInput } from './booking-logic';

const deadline = new Date('2026-10-12T14:00:00');
const before = new Date('2026-10-12T13:59:59');
const at = new Date('2026-10-12T14:00:00');
const after = new Date('2026-10-12T14:00:01');

const base = (over: Partial<CancelQuoteInput> = {}): CancelQuoteInput => ({
    status: 'confirmed',
    policy: { type: 'freeUntil', freeUntilHours: 24, partial: 'firstNight' },
    deadline,
    now: before,
    totalCent: 65600, // 2 晚共 ¥656
    paidCent: 65600,
    firstNightFeeCent: 32800,
    ...over,
});

describe('computeCancelQuote', () => {
    it('免费窗口内：全额退、零扣款', () => {
        const q = computeCancelQuote(base());
        expect(q.mode).toBe('free');
        expect(q.free).toBe(true);
        expect(q.cancellable).toBe(true);
        expect(q.refundCent).toBe(65600);
        expect(q.feeCent).toBe(0);
    });

    it('截止点当刻（now == deadline）仍算免费（闭区间）', () => {
        const q = computeCancelQuote(base({ now: at }));
        expect(q.mode).toBe('free');
        expect(q.refundCent).toBe(65600);
    });

    it('逾时 + firstNight：扣首晚退余款', () => {
        const q = computeCancelQuote(base({ now: after }));
        expect(q.mode).toBe('partial');
        expect(q.free).toBe(false);
        expect(q.feeCent).toBe(32800);
        expect(q.refundCent).toBe(32800);
    });

    it('逾时 + partial=full：扣全款，分文不退（forfeit）', () => {
        const q = computeCancelQuote(
            base({ now: after, policy: { type: 'freeUntil', freeUntilHours: 24, partial: 'full' } }),
        );
        expect(q.mode).toBe('forfeit');
        expect(q.feeCent).toBe(65600);
        expect(q.refundCent).toBe(0);
    });

    it('partial 缺省（未配置口径）按 firstNight', () => {
        const q = computeCancelQuote(
            base({ now: after, policy: { type: 'freeUntil', freeUntilHours: 24 } }),
        );
        expect(q.mode).toBe('partial');
        expect(q.feeCent).toBe(32800);
    });

    it('nonRefundable：恒为 forfeit，即使时间上在窗口内', () => {
        const q = computeCancelQuote(base({ policy: { type: 'nonRefundable' }, deadline: null, now: before }));
        expect(q.mode).toBe('forfeit');
        expect(q.feeCent).toBe(65600);
        expect(q.refundCent).toBe(0);
        expect(q.cancellable).toBe(true);
    });

    it('未配置政策（null）：blocked，顾客不可自助取消', () => {
        const q = computeCancelQuote(base({ policy: null, now: before }));
        expect(q.mode).toBe('blocked');
        expect(q.cancellable).toBe(false);
        expect(q.refundCent).toBe(0);
    });

    it('freeUntil 但截止点未固化（null）：按逾时处理，fail-safe 保护商家', () => {
        const q = computeCancelQuote(base({ deadline: null, now: before }));
        expect(q.mode).toBe('partial');
        expect(q.feeCent).toBe(32800);
    });

    it('未付款（paidCent=0，含仅授权未结算）：unpaid 直接取消无退款', () => {
        const q = computeCancelQuote(base({ status: 'confirmed', paidCent: 0 }));
        expect(q.mode).toBe('unpaid');
        expect(q.cancellable).toBe(true);
        expect(q.refundCent).toBe(0);
        expect(q.feeCent).toBe(0);
    });

    it('pendingDeposit 已有结算款（确认事件延迟边缘）：按全额退', () => {
        const q = computeCancelQuote(base({ status: 'pendingDeposit', paidCent: 32800, now: after }));
        expect(q.mode).toBe('free');
        expect(q.refundCent).toBe(32800);
    });

    it('扣款不超实付：首晚价高于实付（定金场景）时 fee 被钳到 paid', () => {
        // 仅付定金 20000，首晚 32800
        const q = computeCancelQuote(base({ now: after, paidCent: 20000 }));
        expect(q.feeCent).toBe(20000);
        expect(q.refundCent).toBe(0);
        expect(q.mode).toBe('forfeit');
    });

    it('部分付款逾时：退款 = 已付 − 首晚（不出现负数）', () => {
        const q = computeCancelQuote(base({ now: after, paidCent: 50000 }));
        expect(q.feeCent).toBe(32800);
        expect(q.refundCent).toBe(17200);
        expect(q.mode).toBe('partial');
    });

    it('非法/负数输入按 0 容错，不抛异常', () => {
        const q = computeCancelQuote(base({ totalCent: NaN, paidCent: -100, firstNightFeeCent: NaN }));
        expect(q.mode).toBe('unpaid');
        expect(q.refundCent).toBe(0);
    });
});
