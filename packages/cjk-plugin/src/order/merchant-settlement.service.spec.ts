import { describe, expect, it } from 'vitest';
import { COD_PAYMENT_CODES, merchantSettlementStatus } from './merchant-settlement.service';

describe('merchantSettlementStatus', () => {
    it('marks COD / 到店收银 methods as PENDING_SIGN', () => {
        expect(merchantSettlementStatus('cash-on-delivery', COD_PAYMENT_CODES)).toBe('PENDING_SIGN');
    });

    it('marks online / balance methods as PAID', () => {
        expect(merchantSettlementStatus('balance-wallet', COD_PAYMENT_CODES)).toBe('PAID');
        expect(merchantSettlementStatus('alipay', COD_PAYMENT_CODES)).toBe('PAID');
        expect(merchantSettlementStatus('wechatpay', COD_PAYMENT_CODES)).toBe('PAID');
    });

    it('is case-sensitive on method code', () => {
        expect(merchantSettlementStatus('COD', COD_PAYMENT_CODES)).toBe('PAID');
    });

    it('honors a caller-supplied cod code list override', () => {
        expect(merchantSettlementStatus('fixed-aggregate-collection', ['fixed-aggregate-collection'])).toBe(
            'PENDING_SIGN',
        );
        expect(merchantSettlementStatus('alipay', ['fixed-aggregate-collection'])).toBe('PAID');
    });

    it('exposes the COD code used for wiring', () => {
        expect(COD_PAYMENT_CODES).toContain('cash-on-delivery');
    });
});