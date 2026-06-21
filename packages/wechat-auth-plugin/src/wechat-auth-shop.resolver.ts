import { Args, Query, Resolver } from '@nestjs/graphql';
import { WechatAuthService } from './wechat-auth.service';

@Resolver()
export class WechatAuthShopResolver {
    constructor(private wechatAuthService: WechatAuthService) {}

    @Query()
    async wechatJsapiSignature(
        @Args('url') url: string,
    ): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
        return this.wechatAuthService.generateJsapiSignature(url);
    }
}
