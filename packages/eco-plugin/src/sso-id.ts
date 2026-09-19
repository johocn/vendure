import { Customer } from '@vendure/core';

/**
 * 提取 Customer 的 SSO 用户身份 ID（游戏服务器 auth_accounts.sso_id 同源）：
 * 1. customer.customFields.ssoId（预留：若生产后续新增该字段，优先取用）
 * 2. customer.user.identifier 形如 `sso_<providerKey>_<externalId>`
 *    （cjk-plugin SsoAuthenticationStrategy 以 user.identifier 存 `sso_${providerKey}_${uuid}`，
 *    uuid 即 zhao-sso 用户 ID，与游戏服务器 exchange-token 返回的 user.uuid 一致），取 externalId。
 *
 * 非 SSO 登录（native/wechat/phone）或关联信息缺失时返回 undefined，调用方跳过上报。
 */
export function extractSsoId(customer: Customer | undefined | null): string | undefined {
    if (!customer) return undefined;
    const customFields = (customer as any).customFields as Record<string, any> | undefined;
    if (customFields?.ssoId != null && customFields.ssoId !== '') {
        return String(customFields.ssoId);
    }
    const identifier = customer.user?.identifier;
    if (identifier && identifier.startsWith('sso_')) {
        const match = identifier.match(/^sso_(.+)_([^_]+)$/);
        if (match) return match[2];
    }
    return undefined;
}
