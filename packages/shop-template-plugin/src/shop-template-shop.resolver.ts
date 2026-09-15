import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { ShopTemplateService } from './shop-template.service';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';

@Resolver()
export class ShopTemplateShopResolver {
    constructor(private service: ShopTemplateService) {}

    @Query()
    @Allow(Permission.Public)
    async shopTemplate(
        @Ctx() ctx: RequestContext,
        @Args('app') app: string,
        @Args('id') id?: ID,
    ): Promise<ShopTemplate | null> {
        return this.service.shopTemplate(ctx, app as any, id);
    }

    @Query()
    @Allow(Permission.Public)
    async shopGlobalConfig(
        @Ctx() ctx: RequestContext,
        @Args('app') app: string,
    ): Promise<ShopGlobalConfig | null> {
        return this.service.findGlobalConfig(ctx, app as any);
    }
}
