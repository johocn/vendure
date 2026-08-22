// packages/cjk-plugin/src/auth/sso-authentication-strategy.ts
import {
    AuthenticationStrategy,
    RequestContext,
    User,
    Logger,
    Injector,
    UserService,
    CustomerService,
    ExternalAuthenticationService,
    TransactionalConnection,
    ExternalAuthenticationMethod,
    Customer,
} from '@vendure/core';
import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { DistributionService } from '@vendure/distribution-plugin';
import type { SsoProvider } from './auth-config.types';
import { readChannelAuthConfig } from './crypto';
import { InviteCodeService } from './invite-code.service';

const loggerCtx = 'SsoAuthenticationStrategy';

interface SsoAuthData {
    providerKey: string;
    code: string;
    inviteCode?: string;
    redirectUri?: string;
}

export class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = 'sso';

    private userService!: UserService;
    private customerService!: CustomerService;
    private inviteCodeService!: InviteCodeService;
    private externalAuthenticationService!: ExternalAuthenticationService;
    private connection!: TransactionalConnection;
    private distributionService?: DistributionService;
    /** e2e/本地联调用：跳过真实 zhao-sso 换取/取号，按 mock code 直接构造 userInfo（生产默认 false） */
    private mockMode = process.env.SSO_MOCK === 'true';

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.customerService = injector.get(CustomerService);
        this.inviteCodeService = injector.get(InviteCodeService);
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
        this.connection = injector.get(TransactionalConnection);
        // DistributionService 由 distribution-plugin 提供，缺失时优雅降级（不自动开通分销商）
        try {
            this.distributionService = injector.get(DistributionService);
        } catch (e: any) {
            Logger.warn(`DistributionService unavailable, skip auto-distributor: ${e.message}`, loggerCtx);
        }
    }

    defineInputType(): DocumentNode {
        return gql`
            input SsoAuthInput {
                providerKey: String!
                code: String!
                inviteCode: String
                redirectUri: String
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string> {
        const config = readChannelAuthConfig(ctx);
        if (!config?.ssoProviders || config.ssoProviders.length === 0) {
            Logger.warn('No SSO providers configured for channel', loggerCtx);
            return false;
        }

        const provider = config.ssoProviders.find(p => p.providerKey === data.providerKey);
        if (!provider) {
            Logger.warn(`SSO provider "${data.providerKey}" not found`, loggerCtx);
            return false;
        }

        try {
            // 1/2. 获取用户信息：mock 模式下按 code 前缀直接构造（e2e 用，生产走真实换取）
            let userInfo: any | null = null;
            if (this.mockMode && data.code.startsWith('mock-')) {
                const payload = data.code.slice('mock-'.length);
                const [kind, ident] = payload.split('__');
                userInfo = kind === 'loc'
                    ? { uuid: `u_${ident}`, phone_number: ident, mobile: ident, nickname: 'mocked', email: '' }
                    : { uuid: `u_${ident}`, nickname: 'mocked', email: `${ident}@mock.test` };
            } else {
                const tokenRes = await this.exchangeCodeForToken(provider, data.code, data.redirectUri);
                if (!tokenRes?.access_token) {
                    Logger.warn('SSO token exchange failed', loggerCtx);
                    return false;
                }
                userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            }
            if (!userInfo) {
                return false;
            }

            // 3. 映射字段
            const externalId = this.getField(userInfo, provider, 'externalIdField',
                provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
            if (!externalId) {
                Logger.warn('SSO userInfo missing externalId field', loggerCtx);
                return false;
            }

            const email = this.getField(userInfo, provider, 'emailField', 'email');
            const nickname = this.getField(userInfo, provider, 'nicknameField',
                provider.protocol === 'zhao-sso' ? 'nickname' : 'name');
            const mobile = this.getField(userInfo, provider, 'mobileField', 'mobile');
            const avatar = this.getField(userInfo, provider, 'avatarField', 'avatar_url');

            // 4. 统一映射 / 本地互认 / 建档（落 ExternalAuthenticationMethod 映射表）
            const result = await this.resolveSsoUser(ctx, provider, externalId, email, nickname, mobile, avatar);
            // inviteCode 衔接:优先用 data.inviteCode,否则尝试从 userInfo.invite_code 取
            if (result && typeof result === 'object') {
                const finalInviteCode = data.inviteCode || (userInfo as any)?.invite_code;
                if (finalInviteCode) {
                    try {
                        await this.inviteCodeService.bindIfPresent(ctx, String(result.id), String(finalInviteCode));
                    } catch (e: any) {
                        Logger.warn(`Failed to bind invite code: ${e.message}`, loggerCtx);
                    }
                    // 方案A：自动开通分销商（幂等，已存在则直接返回），并把邀请码写入 referredBy（推荐人码）
                    try {
                        await this.distributionService?.apply(ctx, result.id, String(finalInviteCode));
                    } catch (e: any) {
                        Logger.warn(`Failed to auto-apply distributor: ${e.message}`, loggerCtx);
                    }
                }
            }
            return result;
        } catch (e: any) {
            Logger.error(`SSO authentication failed: ${e.message}`, loggerCtx);
            return false;
        }
    }

    private getFieldValue(userInfo: any, mappingField: string | undefined, defaultField: string): string {
        const field = mappingField || defaultField;
        return userInfo[field] || '';
    }

    private getField(userInfo: any, provider: SsoProvider, mappingKey: keyof NonNullable<SsoProvider['userInfoMapping']>, defaultField: string): string {
        const mappingField = provider.userInfoMapping?.[mappingKey];
        return this.getFieldValue(userInfo, mappingField, defaultField);
    }

    private async exchangeCodeForToken(provider: SsoProvider, code: string, redirectUri?: string): Promise<any> {
        if (provider.protocol === 'zhao-sso') {
            const tokenUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/auth/token`;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code,
                    app_code: provider.clientId,
                    app_secret: provider.clientSecret,
                    redirect_uri: redirectUri,
                }),
            });
            return res.json();
        } else {
            const tokenUrl = provider.tokenUrl!;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    client_id: provider.clientId,
                    client_secret: provider.clientSecret,
                }),
            });
            return res.json();
        }
    }

    private async getUserInfo(provider: SsoProvider, accessToken: string): Promise<any | null> {
        const userInfoUrl = provider.protocol === 'zhao-sso'
            ? `${provider.baseUrl.replace(/\/$/, '')}/v1/user/me`
            : provider.userInfoUrl!;

        const res = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            Logger.warn(`SSO userInfo request failed: ${res.status}`, loggerCtx);
            return null;
        }
        return res.json();
    }

    /** 规范化外部键：sso:providerKey:externalId —— 统一映射表键，跨 provider 稳定 */
    private buildExternalKey(providerKey: string, externalId: string): string {
        return `sso:${providerKey}:${externalId}`;
    }

    /**
     * 统一映射 / 本地互认 / 建档：
     * 1. ExternalAuthenticationMethod 映射命中 → 直接返回；
     * 2. 按手机号/邮箱合并已有本地账号 → 给其绑定 SSO 身份；
     * 3. 无本地账号 → 标准建档（落映射 + Customer + 历史）。
     */
    private async resolveSsoUser(
        ctx: RequestContext,
        provider: SsoProvider,
        externalId: string,
        email: string,
        nickname: string,
        mobile: string,
        avatar: string,
    ): Promise<User | false> {
        const externalKey = this.buildExternalKey(provider.providerKey, externalId);
        const strategyName = 'sso';

        // 1) 统一映射表命中 → 直接返回（同一 SSO 用户稳定归一同账号）
        const mapped = await this.externalAuthenticationService.findCustomerUser(ctx, strategyName, externalKey);
        if (mapped) return mapped;

        // 2) 至少同时校验 email+mobile 语义：避免仅凭空值误合并
        const hasIdentity = (email && email.trim()) || (mobile && mobile.trim());

        // 3) 优先按手机号合并已有本地账号（Customer.phoneNumber 是独立列）
        let localUser: User | undefined;
        if (mobile) {
            localUser = await this.findUserByPhone(ctx, mobile);
        }
        // 其次按邮箱（createCustomerAndUser 内部也会按邮箱合并，这里提前解析以复用同引用）
        if (!localUser && hasIdentity && email) {
            const local = await this.userService.getUserByEmailAddress(ctx, email);
            if (local) localUser = local;
        }

        if (localUser) {
            await this.bindSsoIdentity(ctx, localUser, externalKey);
            await this.syncCustomerProfile(ctx, localUser, email, nickname, mobile);
            return localUser;
        }

        // 4) 无本地账号 → 标准建档（ExternalAuthenticationMethod + Customer + 历史）
        return this.externalAuthenticationService.createCustomerAndUser(ctx, {
            strategy: strategyName,
            externalIdentifier: externalKey,
            emailAddress: email,
            firstName: nickname,
            lastName: '',
            verified: true,
        });
    }

    /** 按手机号查已有 Customer → 其关联 User（仅查未删除） */
    private async findUserByPhone(ctx: RequestContext, phone: string): Promise<User | undefined> {
        const customer = await this.connection.getRepository(ctx, Customer).createQueryBuilder('c')
            .leftJoinAndSelect('c.user', 'user')
            .where('c.phoneNumber = :phone', { phone })
            .andWhere('user.deletedAt IS NULL')
            .getOne();
        return customer?.user ?? undefined;
    }

    /** 给已存在 User 挂一个 SSO 外部认证方法（幂等） */
    private async bindSsoIdentity(ctx: RequestContext, user: User, externalKey: string): Promise<void> {
        const methodRepo = this.connection.getRepository(ctx, ExternalAuthenticationMethod);
        const methods = await methodRepo.find({ where: { user: { id: user.id } as any } });
        const already = methods.some(m => m.strategy === 'sso' && m.externalIdentifier === externalKey);
        if (already) return;
        const authMethod = await methodRepo.save(new ExternalAuthenticationMethod({
            strategy: 'sso',
            externalIdentifier: externalKey,
            user: user as any,
        }));
        const userRepo = this.connection.getRepository(ctx, User);
        const fresh = await userRepo.findOne({ where: { id: user.id }, relations: ['authenticationMethods'] });
        if (fresh) {
            fresh.authenticationMethods = [...(fresh.authenticationMethods || []), authMethod];
            await userRepo.save(fresh);
        }
    }

    /** 同步 SSO 资料到 Customer（邮箱/昵称/手机；已有值不覆盖） */
    private async syncCustomerProfile(ctx: RequestContext, user: User, email: string, nickname: string, mobile: string): Promise<void> {
        try {
            const customer = await this.customerService.findOneByUserId(ctx, user.id);
            if (!customer) return;
            await this.customerService.update(ctx, {
                id: customer.id,
                ...(email && !customer.emailAddress ? { emailAddress: email } : {}),
                ...(nickname ? { firstName: nickname } : {}),
                ...(mobile && !customer.phoneNumber ? { phoneNumber: mobile } : {}),
            });
        } catch (e: any) {
            Logger.warn(`Failed to sync SSO customer profile: ${e.message}`, loggerCtx);
        }
    }

    /**
     * 方向B：已登录本地账号回头绑定 SSO 身份。
     * 校验 code（mock 或真实换取）→ 得 externalId → 挂到当前 User。
     * 返回是否绑定成功 + 绑定后的用户标识。
     */
    async bindIdentityToUser(
        ctx: RequestContext,
        provider: SsoProvider,
        code: string,
        currentUserId: string,
        redirectUri?: string,
    ): Promise<{ bound: boolean; userId: string; identifier?: string; reason?: string }> {
        let userInfo: any | null = null;
        if (this.mockMode && code.startsWith('mock-')) {
            const [kind, ident] = code.slice('mock-'.length).split('__');
            userInfo = { uuid: `u_${ident}`, phone_number: kind === 'loc' ? ident : '', email: kind === 'loc' ? '' : `${ident}@mock.test`, nickname: 'mocked' };
        } else {
            const tokenRes = await this.exchangeCodeForToken(provider, code, redirectUri);
            userInfo = tokenRes?.access_token ? await this.getUserInfo(provider, tokenRes.access_token) : null;
        }
        if (!userInfo) return { bound: false, userId: currentUserId, reason: 'code verification failed' };

        const externalId = this.getField(userInfo, provider, 'externalIdField',
            provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
        if (!externalId) return { bound: false, userId: currentUserId, reason: 'missing externalId' };

        const externalKey = this.buildExternalKey(provider.providerKey, externalId);
        const user = await this.userService.getUserById(ctx, currentUserId as any);
        if (!user) return { bound: false, userId: currentUserId, reason: 'user not found' };

        // 映射表可能已挂在其他账号 —— 绑定前检查并拒绝冲突
        const occupied = await this.externalAuthenticationService.findUser(ctx, 'sso', externalKey);
        if (occupied && String(occupied.id) !== String(currentUserId)) {
            return { bound: false, userId: currentUserId, reason: 'sso identity already bound to another account' };
        }
        await this.bindSsoIdentity(ctx, user, externalKey);
        return { bound: true, userId: String(user.id), identifier: externalKey };
    }
}

/** 单例：plugin.ts 注册用同一实例，resolver 可经此访问 bindIdentityToUser */
export const ssoAuthenticationStrategy = new SsoAuthenticationStrategy();
