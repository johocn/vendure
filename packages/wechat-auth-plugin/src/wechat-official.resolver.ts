import { Inject } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Allow, Permission, RequestContext, Ctx } from '@vendure/core';

import { WECHAT_AUTH_PLUGIN_OPTIONS } from './constants';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';

/**
 * 公众号运营 admin API（菜单 / 粉丝 / 模板消息）——微信 cgi-bin 的 GraphQL 代理。
 * 安全：无 @Allow 时 Vendure 默认放行（permissions.length===0 → allow），
 * 匿名即可调用（发布菜单 / 群发模板消息危害大），故显式要求 SuperAdmin；
 * 与 web-admin 前端「仅超管可见」的门禁保持一致。
 */
@Resolver()
export class WechatOfficialResolver {
    constructor(
        @Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions,
        private wechatAuthService: WechatAuthService,
    ) {}

    @Query()
    @Allow(Permission.SuperAdmin)
    async wechatCurrentMenu(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.getOfficialMenu();
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async wechatMenuPublish(@Ctx() ctx: RequestContext, @Args('menu') menu: any): Promise<any> {
        return this.wechatAuthService.createOfficialMenu(menu);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async wechatMenuDelete(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.deleteOfficialMenu();
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async wechatFans(@Ctx() ctx: RequestContext, @Args('nextOpenid', { nullable: true }) nextOpenid?: string): Promise<any> {
        return this.wechatAuthService.getFans(nextOpenid || undefined);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async wechatTemplates(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.getTemplates();
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async wechatTemplateSend(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.wechatAuthService.sendTemplate(input);
    }
}
