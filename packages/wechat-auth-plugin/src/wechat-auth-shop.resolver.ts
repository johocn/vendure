import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { RequestContext, Ctx } from '@vendure/core';
import { WechatAuthService } from './wechat-auth.service';
import { WxacodeService } from './wxacode.service';

@Resolver()
export class WechatAuthShopResolver {
    constructor(
        private wechatAuthService: WechatAuthService,
        private wxacodeService: WxacodeService,
    ) {}

    @Query()
    async wechatJsapiSignature(
        @Args('url') url: string,
    ): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
        return this.wechatAuthService.generateJsapiSignature(url);
    }

    @Query()
    async wechatWxacode(
        @Ctx() ctx: RequestContext,
        @Args('scene') scene: string,
        @Args({ name: 'path', type: () => String, nullable: true }) path?: string,
        @Args({ name: 'width', type: () => Int, nullable: true }) width?: number,
    ): Promise<{ contentType: string; base64: string }> {
        return this.wxacodeService.generateWxacode(ctx, { scene, path, width });
    }
}
