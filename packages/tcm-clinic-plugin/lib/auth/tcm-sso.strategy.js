"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tcmSsoAuthenticationStrategy = exports.TcmSsoAuthenticationStrategy = void 0;
// packages/tcm-clinic-plugin/src/auth/tcm-sso.strategy.ts
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const constants_1 = require("../constants");
const loggerCtx = 'TcmSsoStrategy';
/**
 * Admin API zhao-sso 桥接策略（医生工作台）。
 * H5 经 zhao-sso 统一认证拿到 access_token 后调
 * authenticate(input: { tcmSso: { accessToken } }) 换取管理员会话。
 *
 * 身份映射（命中即用，顺序如下）：
 * 1. ExternalAuthenticationMethod(strategy='tcmSso', externalIdentifier='sso:tcm:<uuid>') 已绑定 → 直接登录；
 * 2. 首登绑定：User.identifier == SSO 手机号，或 User.identifier == SSO 邮箱
 *    （约定：医生 Administrator 账号 identifier 用手机号，或邮箱与 zhao-sso 账号一致），
 *    且该 User 具有非顾客角色 → 自动绑定映射后登录；
 * 3. 都未命中 → 'SSO_ACCOUNT_NOT_LINKED'。
 * 顾客角色账号命中 → 'SSO_ACCOUNT_NOT_STAFF'（防止患者账号登管理端）。
 */
class TcmSsoAuthenticationStrategy {
    constructor() {
        this.name = 'tcmSso';
    }
    async init(injector) {
        this.externalAuthenticationService = injector.get(core_1.ExternalAuthenticationService);
        this.connection = injector.get(core_1.TransactionalConnection);
        this.options = injector.get(constants_1.TCM_PLUGIN_OPTIONS);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input TcmSsoAuthInput {
                accessToken: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        var _a, _b, _c, _d;
        const sso = this.options.sso;
        if (!(sso === null || sso === void 0 ? void 0 : sso.baseUrl)) {
            core_1.Logger.warn('tcm-clinic sso not configured', loggerCtx);
            return 'SSO_NOT_CONFIGURED';
        }
        const mockEnabled = sso.mock === true || process.env.SSO_MOCK === 'true';
        let userInfo = null;
        if (mockEnabled && data.accessToken.startsWith('mock-')) {
            const ident = data.accessToken.slice('mock-'.length);
            userInfo = { uuid: `u_${ident}`, mobile: ident, nickname: 'Mock', email: `${ident}@tcm.test` };
        }
        else {
            try {
                const res = await fetch(`${sso.baseUrl.replace(/\/$/, '')}/v1/user/me`, {
                    headers: { Authorization: `Bearer ${data.accessToken}` },
                });
                if (!res.ok) {
                    core_1.Logger.warn(`zhao-sso /v1/user/me failed: ${res.status}`, loggerCtx);
                    return 'SSO_TOKEN_INVALID';
                }
                userInfo = await res.json();
            }
            catch (e) {
                core_1.Logger.warn(`zhao-sso /v1/user/me error: ${e.message}`, loggerCtx);
                return 'SSO_TOKEN_INVALID';
            }
        }
        const uuid = String((_a = userInfo === null || userInfo === void 0 ? void 0 : userInfo.uuid) !== null && _a !== void 0 ? _a : '');
        const mobile = String((_c = (_b = userInfo === null || userInfo === void 0 ? void 0 : userInfo.mobile) !== null && _b !== void 0 ? _b : userInfo === null || userInfo === void 0 ? void 0 : userInfo.phone_number) !== null && _c !== void 0 ? _c : '');
        const email = String((_d = userInfo === null || userInfo === void 0 ? void 0 : userInfo.email) !== null && _d !== void 0 ? _d : '');
        if (!uuid && !mobile && !email) {
            return 'SSO_IDENTITY_MISSING';
        }
        // 1) 已绑定映射直接登录
        if (uuid) {
            const mapped = await this.externalAuthenticationService.findUser(ctx, this.name, `sso:tcm:${uuid}`);
            if (mapped) {
                // findUser 不加载 roles 关系，需补载后再校验员工角色
                if (!mapped.roles) {
                    const fresh = await this.connection
                        .getRepository(ctx, core_1.User)
                        .findOne({ where: { id: mapped.id }, relations: ['roles'] });
                    if (fresh) {
                        mapped.roles = fresh.roles;
                    }
                }
                return this.assertStaff(mapped);
            }
        }
        // 2) 首登：手机号/邮箱 匹配 User.identifier
        const candidates = [mobile, email].filter(v => !!v);
        for (const identifier of candidates) {
            const user = await this.connection
                .getRepository(ctx, core_1.User)
                .findOne({ where: { identifier }, relations: ['roles'] });
            if (!user)
                continue;
            const staff = await this.assertStaff(user);
            if (typeof staff === 'string') {
                return staff; // NOT_STAFF：顾客账号，直接拒绝，不继续尝试
            }
            if (uuid) {
                await this.bind(ctx, user, `sso:tcm:${uuid}`);
            }
            return user;
        }
        return 'SSO_ACCOUNT_NOT_LINKED';
    }
    /** 校验 User 具备员工（非顾客）角色；否则拒绝 */
    assertStaff(user) {
        const isStaff = (user.roles || []).some(r => r.code !== '__customer_role__');
        return isStaff ? user : 'SSO_ACCOUNT_NOT_STAFF';
    }
    /** 幂等绑定外部认证方法 */
    async bind(ctx, user, externalKey) {
        const methodRepo = this.connection.getRepository(ctx, core_1.ExternalAuthenticationMethod);
        const methods = await methodRepo.find({ where: { user: { id: user.id } } });
        if (methods.some(m => m.strategy === this.name && m.externalIdentifier === externalKey))
            return;
        const authMethod = await methodRepo.save(new core_1.ExternalAuthenticationMethod({
            strategy: this.name,
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
}
exports.TcmSsoAuthenticationStrategy = TcmSsoAuthenticationStrategy;
/** 单例：plugin.ts configuration 注册用 */
exports.tcmSsoAuthenticationStrategy = new TcmSsoAuthenticationStrategy();
//# sourceMappingURL=tcm-sso.strategy.js.map