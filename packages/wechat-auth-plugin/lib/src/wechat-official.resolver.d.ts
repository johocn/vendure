import { RequestContext } from '@vendure/core';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';
/**
 * 公众号运营 admin API（菜单 / 粉丝 / 模板消息）——微信 cgi-bin 的 GraphQL 代理。
 * 安全：无 @Allow 时 Vendure 默认放行（permissions.length===0 → allow），
 * 匿名即可调用（发布菜单 / 群发模板消息危害大），故显式要求 SuperAdmin；
 * 与 web-admin 前端「仅超管可见」的门禁保持一致。
 */
export declare class WechatOfficialResolver {
    private options;
    private wechatAuthService;
    constructor(options: WechatAuthPluginOptions, wechatAuthService: WechatAuthService);
    wechatCurrentMenu(ctx: RequestContext): Promise<any>;
    wechatMenuPublish(ctx: RequestContext, menu: any): Promise<any>;
    wechatMenuDelete(ctx: RequestContext): Promise<any>;
    wechatFans(ctx: RequestContext, nextOpenid?: string): Promise<any>;
    wechatTemplates(ctx: RequestContext): Promise<any>;
    wechatTemplateSend(ctx: RequestContext, input: any): Promise<any>;
}
