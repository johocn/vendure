// P2-5 骑手合规（健康证 / 保险 / 背景调查）：纯函数判定，供 rider.service（上线/抢单资格）
// 与后台审核页共用同一口径，避免前后端口径漂移。
// 判定原则：只在「已登记但失效」时阻断（健康证过期 / 保险过期 / 背调未通过）；
// 未登记视为「待完善」不阻断，避免上线即把存量骑手全部锁死。

/** 到期预警窗口：距到期不足 30 天标记 expiring */
const EXPIRING_DAYS = 30;

export const RIDER_BACKGROUND_CHECK_STATES = ['none', 'pending', 'passed', 'failed'] as const;
export type RiderBackgroundCheck = (typeof RIDER_BACKGROUND_CHECK_STATES)[number];

export type RiderComplianceStatus = 'ok' | 'expiring' | 'expired' | 'pending' | 'missing' | 'failed';

export interface RiderComplianceItem {
    key: 'healthCert' | 'insurance' | 'backgroundCheck';
    label: string;
    status: RiderComplianceStatus;
    /** 到期日（ISO 字符串），无到期概念的项为 null */
    expiry: string | null;
    detail: string | null;
}

export interface RiderComplianceResult {
    /** 全部项均为 ok/expiring 才算合规（未登记为待完善，不影响 ok 之外的 blocked） */
    ok: boolean;
    /** 是否阻断接单/上线：健康证或保险已过期、背调未通过 */
    blocked: boolean;
    /** 是否存在待完善/待背调项（未登记或背调进行中） */
    pending: boolean;
    items: RiderComplianceItem[];
}

function toDate(v: unknown): Date | null {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 到期状态：无到期日 → 已登记但无期限视为 ok */
function expiryStatus(expiry: Date | null, now: Date): 'ok' | 'expiring' | 'expired' {
    if (!expiry) return 'ok';
    if (expiry.getTime() < now.getTime()) return 'expired';
    if (expiry.getTime() - now.getTime() <= EXPIRING_DAYS * 24 * 60 * 60 * 1000) return 'expiring';
    return 'ok';
}

/**
 * 骑手合规判定。
 * @param cf Customer.customFields（或等价对象）
 */
export function evaluateRiderCompliance(cf: Record<string, any> | null | undefined, now: Date = new Date()): RiderComplianceResult {
    const f = cf ?? {};

    // 健康证
    const healthExpiry = toDate(f.riderHealthCertExpiry);
    const hasHealth = !!String(f.riderHealthCertNo ?? '').trim() || !!f.riderHealthCertImg;
    const healthStatus: RiderComplianceStatus = !hasHealth
        ? 'missing'
        : expiryStatus(healthExpiry, now);

    // 保险
    const insuranceExpiry = toDate(f.riderInsuranceExpiry);
    const hasInsurance = !!String(f.riderInsuranceNo ?? '').trim();
    const insuranceStatus: RiderComplianceStatus = !hasInsurance
        ? 'missing'
        : expiryStatus(insuranceExpiry, now);

    // 背景调查
    const bgRaw = String(f.riderBackgroundCheck ?? 'none');
    const bg: RiderBackgroundCheck = (RIDER_BACKGROUND_CHECK_STATES as readonly string[]).includes(bgRaw)
        ? (bgRaw as RiderBackgroundCheck)
        : 'none';
    const bgStatus: RiderComplianceStatus = bg === 'passed' ? 'ok' : bg === 'failed' ? 'failed' : bg === 'pending' ? 'pending' : 'missing';

    const items: RiderComplianceItem[] = [
        { key: 'healthCert', label: '健康证', status: healthStatus, expiry: healthExpiry ? healthExpiry.toISOString() : null, detail: String(f.riderHealthCertNo ?? '') || null },
        { key: 'insurance', label: '保险', status: insuranceStatus, expiry: insuranceExpiry ? insuranceExpiry.toISOString() : null, detail: String(f.riderInsuranceNo ?? '') || null },
        { key: 'backgroundCheck', label: '背景调查', status: bgStatus, expiry: null, detail: bg },
    ];

    const blocked = healthStatus === 'expired' || insuranceStatus === 'expired' || bgStatus === 'failed';
    const pending = items.some(i => i.status === 'missing' || i.status === 'pending');
    const ok = !blocked && !pending;

    return { ok, blocked, pending, items };
}

/** 更新合规资料时的入参校验（返回规范化对象；非法值抛 UserInputError 由调用方抛） */
export interface RiderCompliancePatch {
    healthCertNo?: string | null;
    healthCertImg?: string | null;
    healthCertExpiry?: string | null;
    insuranceNo?: string | null;
    insuranceExpiry?: string | null;
    backgroundCheck?: string | null;
}

export const MAX_COMPLIANCE_TEXT = 128;

/** 校验并规范化合规入参；返回可直接写库的 customFields 片段 */
export function normalizeCompliancePatch(input: RiderCompliancePatch): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const text = (v: unknown, max = MAX_COMPLIANCE_TEXT): string | null => {
        if (v == null) return null;
        const s = String(v).trim();
        if (!s) return null;
        if (s.length > max) throw new Error('合规资料文本过长');
        return s;
    };
    const date = (v: unknown): Date | null => {
        if (v == null || v === '') return null;
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) throw new Error('日期格式不合法');
        return d;
    };

    if ('healthCertNo' in input) out.riderHealthCertNo = text(input.healthCertNo);
    if ('healthCertImg' in input) out.riderHealthCertImg = text(input.healthCertImg, 500);
    if ('healthCertExpiry' in input) out.riderHealthCertExpiry = date(input.healthCertExpiry);
    if ('insuranceNo' in input) out.riderInsuranceNo = text(input.insuranceNo);
    if ('insuranceExpiry' in input) out.riderInsuranceExpiry = date(input.insuranceExpiry);
    if ('backgroundCheck' in input) {
        const raw = String(input.backgroundCheck ?? 'none');
        if (!(RIDER_BACKGROUND_CHECK_STATES as readonly string[]).includes(raw)) {
            throw new Error('背调状态不合法');
        }
        out.riderBackgroundCheck = raw;
        out.riderBackgroundCheckAt = new Date();
    }
    return out;
}