import { AuthenticationStrategy, Injector, RequestContext, User } from '@vendure/core';
import { DocumentNode } from 'graphql';
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
export declare class TcmSsoAuthenticationStrategy implements AuthenticationStrategy<TcmSsoAuthData> {
    readonly name = "tcmSso";
    private externalAuthenticationService;
    private connection;
    private options;
    init(injector: Injector): Promise<void>;
    defineInputType(): DocumentNode;
    authenticate(ctx: RequestContext, data: TcmSsoAuthData): Promise<User | false | string>;
    /** 校验 User 具备员工（非顾客）角色；否则拒绝 */
    private assertStaff;
    /** 幂等绑定外部认证方法 */
    private bind;
}
/** 单例：plugin.ts configuration 注册用 */
export declare const tcmSsoAuthenticationStrategy: TcmSsoAuthenticationStrategy;
export {};
