export declare const RIDER_BACKGROUND_CHECK_STATES: readonly ["none", "pending", "passed", "failed"];
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
/**
 * 骑手合规判定。
 * @param cf Customer.customFields（或等价对象）
 */
export declare function evaluateRiderCompliance(cf: Record<string, any> | null | undefined, now?: Date): RiderComplianceResult;
/** 更新合规资料时的入参校验（返回规范化对象；非法值抛 UserInputError 由调用方抛） */
export interface RiderCompliancePatch {
    healthCertNo?: string | null;
    healthCertImg?: string | null;
    healthCertExpiry?: string | null;
    insuranceNo?: string | null;
    insuranceExpiry?: string | null;
    backgroundCheck?: string | null;
}
export declare const MAX_COMPLIANCE_TEXT = 128;
/** 校验并规范化合规入参；返回可直接写库的 customFields 片段 */
export declare function normalizeCompliancePatch(input: RiderCompliancePatch): Record<string, unknown>;
