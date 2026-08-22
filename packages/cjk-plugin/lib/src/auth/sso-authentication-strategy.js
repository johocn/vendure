"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ssoAuthenticationStrategy = exports.SsoAuthenticationStrategy = void 0;
// packages/cjk-plugin/src/auth/sso-authentication-strategy.ts
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const distribution_plugin_1 = require("@vendure/distribution-plugin");
const crypto_1 = require("./crypto");
const invite_code_service_1 = require("./invite-code.service");
const loggerCtx = 'SsoAuthenticationStrategy';
class SsoAuthenticationStrategy {
    constructor() {
        this.name = 'sso';
        /** e2e/本地联调用：跳过真实 zhao-sso 换取/取号，按 mock code 直接构造 userInfo（生产默认 false） */
        this.mockMode = process.env.SSO_MOCK === 'true';
    }
    async init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.customerService = injector.get(core_1.CustomerService);
        this.inviteCodeService = injector.get(invite_code_service_1.InviteCodeService);
        this.externalAuthenticationService = injector.get(core_1.ExternalAuthenticationService);
        this.connection = injector.get(core_1.TransactionalConnection);
        // DistributionService 由 distribution-plugin 提供，缺失时优雅降级（不自动开通分销商）
        try {
            this.distributionService = injector.get(distribution_plugin_1.DistributionService);
        }
        catch (e) {
            core_1.Logger.warn(`DistributionService unavailable, skip auto-distributor: ${e.message}`, loggerCtx);
        }
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input SsoAuthInput {
                providerKey: String!
                code: String!
                inviteCode: String
                redirectUri: String
            }
        `;
    }
    async authenticate(ctx, data) {
        var _a;
        const config = (0, crypto_1.readChannelAuthConfig)(ctx);
        if (!(config === null || config === void 0 ? void 0 : config.ssoProviders) || config.ssoProviders.length === 0) {
            core_1.Logger.warn('No SSO providers configured for channel', loggerCtx);
            return false;
        }
        const provider = config.ssoProviders.find(p => p.providerKey === data.providerKey);
        if (!provider) {
            core_1.Logger.warn(`SSO provider "${data.providerKey}" not found`, loggerCtx);
            return false;
        }
        try {
            // 1/2. 获取用户信息：mock 模式下按 code 前缀直接构造（e2e 用，生产走真实换取）
            let userInfo = null;
            if (this.mockMode && data.code.startsWith('mock-')) {
                const payload = data.code.slice('mock-'.length);
                const [kind, ident] = payload.split('__');
                userInfo = kind === 'loc'
                    ? { uuid: `u_${ident}`, phone_number: ident, mobile: ident, nickname: 'mocked', email: '' }
                    : { uuid: `u_${ident}`, nickname: 'mocked', email: `${ident}@mock.test` };
            }
            else {
                const tokenRes = await this.exchangeCodeForToken(provider, data.code, data.redirectUri);
                if (!(tokenRes === null || tokenRes === void 0 ? void 0 : tokenRes.access_token)) {
                    core_1.Logger.warn('SSO token exchange failed', loggerCtx);
                    return false;
                }
                userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            }
            if (!userInfo) {
                return false;
            }
            // 3. 映射字段
            const externalId = this.getField(userInfo, provider, 'externalIdField', provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
            if (!externalId) {
                core_1.Logger.warn('SSO userInfo missing externalId field', loggerCtx);
                return false;
            }
            const email = this.getField(userInfo, provider, 'emailField', 'email');
            const nickname = this.getField(userInfo, provider, 'nicknameField', provider.protocol === 'zhao-sso' ? 'nickname' : 'name');
            const mobile = this.getField(userInfo, provider, 'mobileField', 'mobile');
            const avatar = this.getField(userInfo, provider, 'avatarField', 'avatar_url');
            // 4. 统一映射 / 本地互认 / 建档（落 ExternalAuthenticationMethod 映射表）
            const result = await this.resolveSsoUser(ctx, provider, externalId, email, nickname, mobile, avatar);
            // inviteCode 衔接:优先用 data.inviteCode,否则尝试从 userInfo.invite_code 取
            if (result && typeof result === 'object') {
                const finalInviteCode = data.inviteCode || (userInfo === null || userInfo === void 0 ? void 0 : userInfo.invite_code);
                if (finalInviteCode) {
                    try {
                        await this.inviteCodeService.bindIfPresent(ctx, String(result.id), String(finalInviteCode));
                    }
                    catch (e) {
                        core_1.Logger.warn(`Failed to bind invite code: ${e.message}`, loggerCtx);
                    }
                    // 方案A：自动开通分销商（幂等，已存在则直接返回），并把邀请码写入 referredBy（推荐人码）
                    try {
                        await ((_a = this.distributionService) === null || _a === void 0 ? void 0 : _a.apply(ctx, result.id, String(finalInviteCode)));
                    }
                    catch (e) {
                        core_1.Logger.warn(`Failed to auto-apply distributor: ${e.message}`, loggerCtx);
                    }
                }
            }
            return result;
        }
        catch (e) {
            core_1.Logger.error(`SSO authentication failed: ${e.message}`, loggerCtx);
            return false;
        }
    }
    getFieldValue(userInfo, mappingField, defaultField) {
        const field = mappingField || defaultField;
        return userInfo[field] || '';
    }
    getField(userInfo, provider, mappingKey, defaultField) {
        var _a;
        const mappingField = (_a = provider.userInfoMapping) === null || _a === void 0 ? void 0 : _a[mappingKey];
        return this.getFieldValue(userInfo, mappingField, defaultField);
    }
    async exchangeCodeForToken(provider, code, redirectUri) {
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
        }
        else {
            const tokenUrl = provider.tokenUrl;
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
    async getUserInfo(provider, accessToken) {
        const userInfoUrl = provider.protocol === 'zhao-sso'
            ? `${provider.baseUrl.replace(/\/$/, '')}/v1/user/me`
            : provider.userInfoUrl;
        const res = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            core_1.Logger.warn(`SSO userInfo request failed: ${res.status}`, loggerCtx);
            return null;
        }
        return res.json();
    }
    /** 规范化外部键：sso:providerKey:externalId —— 统一映射表键，跨 provider 稳定 */
    buildExternalKey(providerKey, externalId) {
        return `sso:${providerKey}:${externalId}`;
    }
    /**
     * 统一映射 / 本地互认 / 建档：
     * 1. ExternalAuthenticationMethod 映射命中 → 直接返回；
     * 2. 按手机号/邮箱合并已有本地账号 → 给其绑定 SSO 身份；
     * 3. 无本地账号 → 标准建档（落映射 + Customer + 历史）。
     */
    async resolveSsoUser(ctx, provider, externalId, email, nickname, mobile, avatar) {
        const externalKey = this.buildExternalKey(provider.providerKey, externalId);
        const strategyName = 'sso';
        // 1) 统一映射表命中 → 直接返回（同一 SSO 用户稳定归一同账号）
        const mapped = await this.externalAuthenticationService.findCustomerUser(ctx, strategyName, externalKey);
        if (mapped)
            return mapped;
        // 2) 至少同时校验 email+mobile 语义：避免仅凭空值误合并
        const hasIdentity = (email && email.trim()) || (mobile && mobile.trim());
        // 3) 优先按手机号合并已有本地账号（Customer.phoneNumber 是独立列）
        let localUser;
        if (mobile) {
            localUser = await this.findUserByPhone(ctx, mobile);
        }
        // 其次按邮箱（createCustomerAndUser 内部也会按邮箱合并，这里提前解析以复用同引用）
        if (!localUser && hasIdentity && email) {
            const local = await this.userService.getUserByEmailAddress(ctx, email);
            if (local)
                localUser = local;
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
    async findUserByPhone(ctx, phone) {
        var _a;
        const customer = await this.connection.getRepository(ctx, core_1.Customer).createQueryBuilder('c')
            .leftJoinAndSelect('c.user', 'user')
            .where('c.phoneNumber = :phone', { phone })
            .andWhere('user.deletedAt IS NULL')
            .getOne();
        return (_a = customer === null || customer === void 0 ? void 0 : customer.user) !== null && _a !== void 0 ? _a : undefined;
    }
    /** 给已存在 User 挂一个 SSO 外部认证方法（幂等） */
    async bindSsoIdentity(ctx, user, externalKey) {
        const methodRepo = this.connection.getRepository(ctx, core_1.ExternalAuthenticationMethod);
        const methods = await methodRepo.find({ where: { user: { id: user.id } } });
        const already = methods.some(m => m.strategy === 'sso' && m.externalIdentifier === externalKey);
        if (already)
            return;
        const authMethod = await methodRepo.save(new core_1.ExternalAuthenticationMethod({
            strategy: 'sso',
            externalIdentifier: externalKey,
            user: user,
        }));
        const userRepo = this.connection.getRepository(ctx, core_1.User);
        const fresh = await userRepo.findOne({ where: { id: user.id }, relations: ['authenticationMethods'] });
        if (fresh) {
            fresh.authenticationMethods = [...(fresh.authenticationMethods || []), authMethod];
            await userRepo.save(fresh);
        }
    }
    /** 同步 SSO 资料到 Customer（邮箱/昵称/手机；已有值不覆盖） */
    async syncCustomerProfile(ctx, user, email, nickname, mobile) {
        try {
            const customer = await this.customerService.findOneByUserId(ctx, user.id);
            if (!customer)
                return;
            await this.customerService.update(ctx, Object.assign(Object.assign(Object.assign({ id: customer.id }, (email && !customer.emailAddress ? { emailAddress: email } : {})), (nickname ? { firstName: nickname } : {})), (mobile && !customer.phoneNumber ? { phoneNumber: mobile } : {})));
        }
        catch (e) {
            core_1.Logger.warn(`Failed to sync SSO customer profile: ${e.message}`, loggerCtx);
        }
    }
    /**
     * 方向B：已登录本地账号回头绑定 SSO 身份。
     * 校验 code（mock 或真实换取）→ 得 externalId → 挂到当前 User。
     * 返回是否绑定成功 + 绑定后的用户标识。
     */
    async bindIdentityToUser(ctx, provider, code, currentUserId, redirectUri) {
        let userInfo = null;
        if (this.mockMode && code.startsWith('mock-')) {
            const [kind, ident] = code.slice('mock-'.length).split('__');
            userInfo = { uuid: `u_${ident}`, phone_number: kind === 'loc' ? ident : '', email: kind === 'loc' ? '' : `${ident}@mock.test`, nickname: 'mocked' };
        }
        else {
            const tokenRes = await this.exchangeCodeForToken(provider, code, redirectUri);
            userInfo = (tokenRes === null || tokenRes === void 0 ? void 0 : tokenRes.access_token) ? await this.getUserInfo(provider, tokenRes.access_token) : null;
        }
        if (!userInfo)
            return { bound: false, userId: currentUserId, reason: 'code verification failed' };
        const externalId = this.getField(userInfo, provider, 'externalIdField', provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
        if (!externalId)
            return { bound: false, userId: currentUserId, reason: 'missing externalId' };
        const externalKey = this.buildExternalKey(provider.providerKey, externalId);
        const user = await this.userService.getUserById(ctx, currentUserId);
        if (!user)
            return { bound: false, userId: currentUserId, reason: 'user not found' };
        // 映射表可能已挂在其他账号 —— 绑定前检查并拒绝冲突
        const occupied = await this.externalAuthenticationService.findUser(ctx, 'sso', externalKey);
        if (occupied && String(occupied.id) !== String(currentUserId)) {
            return { bound: false, userId: currentUserId, reason: 'sso identity already bound to another account' };
        }
        await this.bindSsoIdentity(ctx, user, externalKey);
        return { bound: true, userId: String(user.id), identifier: externalKey };
    }
}
exports.SsoAuthenticationStrategy = SsoAuthenticationStrategy;
/** 单例：plugin.ts 注册用同一实例，resolver 可经此访问 bindIdentityToUser */
exports.ssoAuthenticationStrategy = new SsoAuthenticationStrategy();
//# sourceMappingURL=sso-authentication-strategy.js.map