import { Inject } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Allow, PermissionDefinition, RequestContext, Ctx } from '@vendure/core';

import { WECHAT_AUTH_PLUGIN_OPTIONS } from './constants';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';

/**
 * 公众号运营 admin API（菜单 / 粉丝 / 模板消息）——微信 cgi-bin 的 GraphQL 代理。
 * admin-api 默认要求认证，运营后台登录态即可调用。
 */
@Resolver()
export class WechatOfficialResolver {
    constructor(
        @Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions,
        private wechatAuthService: WechatAuthService,
    ) {}

    @Query()
    async wechatCurrentMenu(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.getOfficialMenu();
    }

    @Mutation()
    async wechatMenuPublish(@Ctx() ctx: RequestContext, @Args('menu') menu: any): Promise<any> {
        return this.wechatAuthService.createOfficialMenu(menu);
    }

    @Mutation()
    async wechatMenuDelete(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.deleteOfficialMenu();
    }

    @Query()
    async wechatFans(@Ctx() ctx: RequestContext, @Args('nextOpenid', { nullable: true }) nextOpenid?: string): Promise<any> {
        return this.wechatAuthService.getFans(nextOpenid || undefined);
    }

    @Query()
    async wechatTemplates(@Ctx() ctx: RequestContext): Promise<any> {
        return this.wechatAuthService.getTemplates();
    }

    @Mutation()
    async wechatTemplateSend(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.wechatAuthService.sendTemplate(input);
    }
}
