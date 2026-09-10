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
    ChannelService,
    Role,
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
    code?: string;
    accessToken?: string;
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
    private channelService!: ChannelService;
    /** e2e/本地联调用：跳过真实 zhao-sso 换取/取号，按 mock code 直接构造 userInfo（生产默认 false） */
    private mockMode = process.env.SSO_MOCK === 'true';

    async init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.customerService = injector.get(CustomerService);
        this.inviteCodeService = injector.get(InviteCodeService);
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
        this.connection = injector.get(TransactionalConnection);
        this.channelService = injector.get(ChannelService);
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
                code: String
                accessToken: String
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
            // 1/2. 获取用户信息：
            //   - accessToken 直验模式（统一页已登录回跳携带 token）：直接 call /v1/user/me 取号
            //   - 授权码模式：先用 code 换 access_token，再取号
            //   - mock 模式（e2e/本地）：按 code 前缀直接构造 userInfo
            let userInfo: any | null = null;
            if (data.accessToken && !this.mockMode) {
                userInfo = await this.getUserInfo(provider, data.accessToken);
            } else if (this.mockMode && data.code?.startsWith('mock-')) {
                const payload = data.code.slice('mock-'.length);
                const [kind, ident] = payload.split('__');
                userInfo = kind === 'loc'
                    ? { uuid: `u_${ident}`, phone_number: ident, mobile: ident, nickname: 'mocked', email: '' }
                    : { uuid: `u_${ident}`, nickname: 'mocked', email: `${ident}@mock.test` };
            } else if (data.code) {
                const tokenRes = await this.exchangeCodeForToken(provider, data.code, data.redirectUri);
                if (!tokenRes?.access_token) {
                    Logger.warn('SSO token exchange failed', loggerCtx);
                    return false;
                }
                userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            }
            if (!userInfo) {
                Logger.warn('SSO userInfo is empty (no valid accessToken or code)', loggerCtx);
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
            // sso 数字 id 号（如 zhao-sso 的自增主键 id，短小好记）；本地 ssoId 字段按此原样复建，不补位
            const ssoNumericId = this.getField(userInfo, provider, 'idField', 'id');

            // 4. 统一映射 / 本地互认 / 建档（落 ExternalAuthenticationMethod 映射表）
            const result = await this.resolveSsoUser(ctx, provider, externalId, email, nickname, mobile, avatar);
            // ssoId / inviteCode / 自动分销均挂在 Customer 维度：先把 User.id 解析成真实 Customer.id，
            // 避免此前的 User.id 与 Customer.id 错位（customerService.findOne 按 customer 主键查，
            // 传入 user.id 会导致查不到 → 邀请码/分销/ssoId 永远落不到正确的本地顾客）。
            if (result && typeof result === 'object') {
                const customer = await this.customerService.findOneByUserId(ctx, result.id, false);
                if (customer) {
                    // ssoId：直接复建 SSO 的数字 id（自增主键，短小好记），原样写入、不补位；
                    // 幂等：仅当字段为空时写入，避免覆盖后续可能被手动修正的值。
                    const cid = String(customer.id);
                    const cf = (customer as any).customFields || {};
                    const numericId = String(ssoNumericId ?? '');
                    if (numericId && !cf.ssoId) {
                        try {
                            await this.customerService.update(ctx, {
                                id: customer.id as any,
                                customFields: { ssoId: numericId },
                            });
                        } catch (e: any) {
                            Logger.warn(`Failed to persist ssoId: ${e.message}`, loggerCtx);
                        }
                    }
                    // inviteCode 衔接：优先用 data.inviteCode，否则取 SSO 用户注册时使用的邀请码
                    // （sso_users.invite_code_used，zhao-sso /v1/user/me 返回 sanitize 全字段，此字段名即 invite_code_used）
                    const finalInviteCode = data.inviteCode
                        || (userInfo as any)?.invite_code_used
                        || (userInfo as any)?.invite_code;
                    if (finalInviteCode) {
                        try {
                            await this.inviteCodeService.bindIfPresent(ctx, cid, String(finalInviteCode));
                        } catch (e: any) {
                            Logger.warn(`Failed to bind invite code: ${e.message}`, loggerCtx);
                        }
                        // 方案A：自动开通分销商（幂等，已存在则直接返回），并把邀请码写入 referredBy（推荐人码）
                        try {
                            await this.distributionService?.apply(ctx, customer.id as any, String(finalInviteCode));
                        } catch (e: any) {
                            Logger.warn(`Failed to auto-apply distributor: ${e.message}`, loggerCtx);
                        }
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

        // 1) 统一映射表命中（跨渠道）→ 复用同一顾客。务必用跨渠道 findUser 而非
        //    findCustomerUser（后者默认仅当前渠道）：否则用户已在其他渠道建档后，
        //    在本渠道登录会再为其创建 Customer，撞 customer.userId 唯一约束 → 报
        //    "the provided credentials are invalid"（策略 catch → return false）。
        const mappedUser = await this.externalAuthenticationService.findUser(ctx, strategyName, externalKey);
        if (mappedUser) {
            await this.ensureCustomerInChannel(ctx, mappedUser);
            return mappedUser;
        }

        // 2) 至少同时校验 email+mobile 语义：避免仅凭空值误合并
        const hasIdentity = (email && email.trim()) || (mobile && mobile.trim());

        // 3) 优先按手机号合并已有本地账号（Customer.phoneNumber 是独立列，跨渠道查）
        let localUser: User | undefined;
        if (mobile) {
            localUser = await this.findUserByPhone(ctx, mobile);
        }
        // 其次按邮箱合并。必须用与 Vendure createCustomerAndUser 同语义的跨渠道查询
        // （findUserByEmailAnyChannel），不能用 userService.getUserByEmailAddress——
        // 它按当前渠道过滤，会漏掉其他渠道已建档的顾客，放行下方 createCustomerAndUser；
        // 而后者又按渠道过滤 findOneByUserId 判「是否已有 customer」，造成跨渠道下
        // 对同一 user 再建 Customer，撞 customer.userId 唯一约束。
        if (!localUser && hasIdentity && email) {
            localUser = await this.findUserByEmailAnyChannel(ctx, email);
        }

        if (localUser) {
            await this.ensureCustomerInChannel(ctx, localUser);
            await this.bindSsoIdentity(ctx, localUser, externalKey);
            await this.syncCustomerProfile(ctx, localUser, email, nickname, mobile);
            return localUser;
        }

        // 4) 无任何本地账号可合并 → 直接自建全新 SSO 账号。
        //    不能复用 externalAuthenticationService.createCustomerAndUser：它会在无邮箱时按“空邮箱”
        //    跨渠道合并到任意一个已在别的渠道建档的空邮箱 Customer，随后又按当前渠道判定
        //    “无该 customer”，于是为同一 user 再插一条 Customer，撞 customer.userId 唯一约束
        //    （日志：duplicate key ... REL_3f62b42ed... = customer UNIQUE(userId)）。
        //    因此这里务必新建唯一 User（identifier 用 externalKey，避免撞既有空串/邮箱 identifier），
        //    新 Customer 绑定新 User，并挂到当前渠道。
        const freshUser = await this.createFreshSsoUser(ctx, externalKey, email, nickname, mobile);
        await this.ensureCustomerInChannel(ctx, freshUser);
        return freshUser;
    }

    /** 为首次登录的 SSO 用户新建唯一账号（User + SSO 外部认证方法 + Customer），并挂载当前渠道 */
    private async createFreshSsoUser(
        ctx: RequestContext,
        externalKey: string,
        email: string,
        nickname: string,
        mobile: string | undefined,
    ): Promise<User> {
        const customerRole = await this.connection
            .getRepository(ctx, Role)
            .createQueryBuilder('role')
            .where('role.code = :code', { code: '__customer_role__' })
            .getOne();

        const authMethod = await this.connection.getRepository(ctx, ExternalAuthenticationMethod).save(
            new ExternalAuthenticationMethod({ externalIdentifier: externalKey, strategy: 'sso' }),
        );

        const user = new User({
            identifier: externalKey,
            roles: customerRole ? [customerRole as any] : [],
            verified: true,
            authenticationMethods: [authMethod],
        });
        const savedUser = await this.connection.getRepository(ctx, User).save(user);

        const customer = new Customer({
            emailAddress: email || '',
            firstName: nickname || '',
            lastName: '',
            phoneNumber: mobile || undefined,
            user: savedUser as any,
        });
        await this.connection.getRepository(ctx, Customer).save(customer);
        return savedUser;
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

    /** 按邮箱跨渠道查已有 Customer → 其关联 User（与 Vendure createCustomerAndUser 的邮箱合并同语义，避免跨渠道重复建档） */
    private async findUserByEmailAnyChannel(ctx: RequestContext, email: string): Promise<User | undefined> {
        const customer = await this.connection.getRepository(ctx, Customer).createQueryBuilder('c')
            .leftJoinAndSelect('c.user', 'user')
            .where('c.emailAddress = :email', { email })
            .andWhere('user.deletedAt IS NULL')
            .getOne();
        return customer?.user ?? undefined;
    }

    /** 让某个已存在 User 的 Customer 在当前渠道可用：customer 缺失则建档，存在则挂到当前渠道。
     *  避免为同一 user 在多个渠道重复创建 Customer（撞 customer.userId 唯一约束）。 */
    private async ensureCustomerInChannel(ctx: RequestContext, user: User): Promise<void> {
        let customer = await this.customerService.findOneByUserId(ctx, user.id, false);
        if (!customer) {
            customer = await this.connection.getRepository(ctx, Customer).save(
                new Customer({ emailAddress: '', firstName: '', lastName: '', user: user as any }),
            );
        }
        if (ctx.channelId) {
            // assignToChannels 幂等：重复挂载已有渠道不会重复或报错
            await this.channelService.assignToChannels(ctx, Customer, customer.id, [ctx.channelId]);
        }
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
