import { AuthenticationStrategy, RequestContext, User, Injector } from '@vendure/core';
import { DocumentNode } from 'graphql';
import type { SsoProvider } from './auth-config.types';
interface SsoAuthData {
    providerKey: string;
    code: string;
    inviteCode?: string;
    redirectUri?: string;
}
export declare class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = "sso";
    private userService;
    private customerService;
    private inviteCodeService;
    private externalAuthenticationService;
    private connection;
    private distributionService?;
    /** e2e/本地联调用：跳过真实 zhao-sso 换取/取号，按 mock code 直接构造 userInfo（生产默认 false） */
    private mockMode;
    init(injector: Injector): Promise<void>;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string>;
    private getFieldValue;
    private getField;
    private exchangeCodeForToken;
    private getUserInfo;
    /** 规范化外部键：sso:providerKey:externalId —— 统一映射表键，跨 provider 稳定 */
    private buildExternalKey;
    /**
     * 统一映射 / 本地互认 / 建档：
     * 1. ExternalAuthenticationMethod 映射命中 → 直接返回；
     * 2. 按手机号/邮箱合并已有本地账号 → 给其绑定 SSO 身份；
     * 3. 无本地账号 → 标准建档（落映射 + Customer + 历史）。
     */
    private resolveSsoUser;
    /** 按手机号查已有 Customer → 其关联 User（仅查未删除） */
    private findUserByPhone;
    /** 给已存在 User 挂一个 SSO 外部认证方法（幂等） */
    private bindSsoIdentity;
    /** 同步 SSO 资料到 Customer（邮箱/昵称/手机；已有值不覆盖） */
    private syncCustomerProfile;
    /**
     * 方向B：已登录本地账号回头绑定 SSO 身份。
     * 校验 code（mock 或真实换取）→ 得 externalId → 挂到当前 User。
     * 返回是否绑定成功 + 绑定后的用户标识。
     */
    bindIdentityToUser(ctx: RequestContext, provider: SsoProvider, code: string, currentUserId: string, redirectUri?: string): Promise<{
        bound: boolean;
        userId: string;
        identifier?: string;
        reason?: string;
    }>;
}
/** 单例：plugin.ts 注册用同一实例，resolver 可经此访问 bindIdentityToUser */
export declare const ssoAuthenticationStrategy: SsoAuthenticationStrategy;
export {};
