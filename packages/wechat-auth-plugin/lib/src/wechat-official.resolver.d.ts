import { RequestContext } from '@vendure/core';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';
/**
 * 公众号运营 admin API（菜单 / 粉丝 / 模板消息）——微信 cgi-bin 的 GraphQL 代理。
 * admin-api 默认要求认证，运营后台登录态即可调用。
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
