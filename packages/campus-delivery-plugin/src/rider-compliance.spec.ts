// P2-5 骑手合规判定单测：未登记待完善不阻断 / 过期与背调未通过阻断 / 到期预警 / 入参校验
import { describe, expect, it } from 'vitest';
import { evaluateRiderCompliance, normalizeCompliancePatch } from './rider-compliance';

const now = new Date('2026-10-27T00:00:00.000Z');

describe('evaluateRiderCompliance', () => {
    it('未登记任何资料：不阻断，标记待完善', () => {
        const r = evaluateRiderCompliance({}, now);
        expect(r.blocked).toBe(false);
        expect(r.pending).toBe(true);
        expect(r.ok).toBe(false);
        expect(r.items.map(i => i.status)).toEqual(['missing', 'missing', 'missing']);
    });

    it('健康证/保险有效 + 背调通过：合规', () => {
        const r = evaluateRiderCompliance({
            riderHealthCertNo: 'HC-1',
            riderHealthCertExpiry: '2027-01-01T00:00:00.000Z',
            riderInsuranceNo: 'INS-1',
            riderInsuranceExpiry: '2027-06-01T00:00:00.000Z',
            riderBackgroundCheck: 'passed',
        }, now);
        expect(r).toMatchObject({ ok: true, blocked: false, pending: false });
        expect(r.items.every(i => i.status === 'ok')).toBe(true);
    });

    it('健康证过期阻断；保险过期阻断', () => {
        expect(evaluateRiderCompliance({ riderHealthCertNo: 'HC', riderHealthCertExpiry: '2026-01-01T00:00:00.000Z', riderBackgroundCheck: 'passed' }, now).blocked).toBe(true);
        expect(evaluateRiderCompliance({ riderInsuranceNo: 'INS', riderInsuranceExpiry: '2026-01-01T00:00:00.000Z', riderBackgroundCheck: 'passed' }, now).blocked).toBe(true);
    });

    it('背调未通过阻断；背调进行中仅待完善', () => {
        expect(evaluateRiderCompliance({ riderBackgroundCheck: 'failed' }, now).blocked).toBe(true);
        const pendingBg = evaluateRiderCompliance({ riderBackgroundCheck: 'pending' }, now);
        expect(pendingBg.blocked).toBe(false);
        expect(pendingBg.pending).toBe(true);
    });

    it('30 天内到期标记 expiring（不阻断）', () => {
        const r = evaluateRiderCompliance({ riderHealthCertNo: 'HC', riderHealthCertExpiry: '2026-11-10T00:00:00.000Z', riderBackgroundCheck: 'passed' }, now);
        expect(r.blocked).toBe(false);
        expect(r.items[0].status).toBe('expiring');
    });

    it('仅登记照片（无编号）也算已登记', () => {
        const r = evaluateRiderCompliance({ riderHealthCertImg: 'asset://x', riderHealthCertExpiry: '2027-01-01T00:00:00.000Z' }, now);
        expect(r.items[0].status).toBe('ok');
    });
});

describe('normalizeCompliancePatch', () => {
    it('按字段存在性写库，空串归 null', () => {
        expect(normalizeCompliancePatch({ healthCertNo: '  HC-1 ', insuranceNo: '' }))
            .toEqual({ riderHealthCertNo: 'HC-1', riderInsuranceNo: null });
    });

    it('日期不合法抛错', () => {
        expect(() => normalizeCompliancePatch({ healthCertExpiry: 'not-a-date' })).toThrow('日期格式不合法');
    });

    it('背调非法值抛错；合法值附带完成时间', () => {
        expect(() => normalizeCompliancePatch({ backgroundCheck: 'weird' })).toThrow('背调状态不合法');
        const ok = normalizeCompliancePatch({ backgroundCheck: 'passed' });
        expect(ok.riderBackgroundCheck).toBe('passed');
        expect(ok.riderBackgroundCheckAt).toBeInstanceOf(Date);
    });

    it('文本超长抛错', () => {
        expect(() => normalizeCompliancePatch({ healthCertNo: 'x'.repeat(129) })).toThrow('合规资料文本过长');
    });
});