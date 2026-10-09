// packages/tcm-clinic-plugin/src/auth/tcm-sso.strategy.ts
import {
    AuthenticationStrategy,
    ExternalAuthenticationMethod,
    ExternalAuthenticationService,
    Injector,
    Logger,
    RequestContext,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';

import { TCM_PLUGIN_OPTIONS } from '../constants';
import { TcmClinicPluginOptions } from '../types';

const loggerCtx = 'TcmSsoStrategy';

interface TcmSsoAuthData {
    accessToken: string;
}

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
export class TcmSsoAuthenticationStrategy implements AuthenticationStrategy<TcmSsoAuthData> {
    readonly name = 'tcmSso';

    private externalAuthenticationService!: ExternalAuthenticationService;
    private connection!: TransactionalConnection;
    private options!: TcmClinicPluginOptions;

    async init(injector: Injector) {
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
        this.connection = injector.get(TransactionalConnection);
        this.options = injector.get(TCM_PLUGIN_OPTIONS);
    }

    defineInputType(): DocumentNode {
        return gql`
            input TcmSsoAuthInput {
                accessToken: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: TcmSsoAuthData): Promise<User | false | string> {
        const sso = this.options.sso;
        if (!sso?.baseUrl) {
            Logger.warn('tcm-clinic sso not configured', loggerCtx);
            return 'SSO_NOT_CONFIGURED';
        }
        const mockEnabled = sso.mock === true || process.env.SSO_MOCK === 'true';
        let userInfo: any | null = null;
        if (mockEnabled && data.accessToken.startsWith('mock-')) {
            const ident = data.accessToken.slice('mock-'.length);
            userInfo = { uuid: `u_${ident}`, mobile: ident, nickname: 'Mock', email: `${ident}@tcm.test` };
        } else {
            try {
                const res = await fetch(`${sso.baseUrl.replace(/\/$/, '')}/v1/user/me`, {
                    headers: { Authorization: `Bearer ${data.accessToken}` },
                });
                if (!res.ok) {
                    Logger.warn(`zhao-sso /v1/user/me failed: ${res.status}`, loggerCtx);
                    return 'SSO_TOKEN_INVALID';
                }
                userInfo = await res.json();
            } catch (e: any) {
                Logger.warn(`zhao-sso /v1/user/me error: ${e.message}`, loggerCtx);
                return 'SSO_TOKEN_INVALID';
            }
        }
        const uuid = String(userInfo?.uuid ?? '');
        const mobile = String(userInfo?.mobile ?? userInfo?.phone_number ?? '');
        const email = String(userInfo?.email ?? '');
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
                        .getRepository(ctx, User)
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
                .getRepository(ctx, User)
                .findOne({ where: { identifier }, relations: ['roles'] });
            if (!user) continue;
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
    private assertStaff(user: User): User | string {
        const isStaff = (user.roles || []).some(r => r.code !== '__customer_role__');
        return isStaff ? user : 'SSO_ACCOUNT_NOT_STAFF';
    }

    /** 幂等绑定外部认证方法 */
    private async bind(ctx: RequestContext, user: User, externalKey: string): Promise<void> {
        const methodRepo = this.connection.getRepository(ctx, ExternalAuthenticationMethod);
        const methods = await methodRepo.find({ where: { user: { id: user.id } as any } });
        if (methods.some(m => m.strategy === this.name && m.externalIdentifier === externalKey)) return;
        const authMethod = await methodRepo.save(
            new ExternalAuthenticationMethod({
                strategy: this.name,
                externalIdentifier: externalKey,
                user: user as any,
            }),
        );
        const userRepo = this.connection.getRepository(ctx, User);
        const fresh = await userRepo.findOne({ where: { id: user.id }, relations: ['authenticationMethods'] });
        if (fresh) {
            fresh.authenticationMethods = [...(fresh.authenticationMethods || []), authMethod];
            await userRepo.save(fresh);
        }
    }
}

/** 单例：plugin.ts configuration 注册用 */
export const tcmSsoAuthenticationStrategy = new TcmSsoAuthenticationStrategy();
