// e:\code\vendure\packages\cjk-plugin\src\auth\auth-admin.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Allow, RequestContext, Ctx as CtxParam, Permission, ChannelService } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';

@Resolver()
export class AuthAdminResolver {
    constructor(
        @Inject(ChannelService) private channelService: ChannelService,
        @Inject(AuthConfigService) private authConfigService: AuthConfigService,
    ) {}

    private assertChannelAccess(ctx: RequestContext, channelId: string) {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) return;
        const channelPermissions = (ctx as any).session?.user?.channelPermissions || [];
        const allowed = channelPermissions.some((c: any) => String(c.id) === String(channelId));
        if (!allowed) throw new Error('TENANT_CONFIG_FORBIDDEN');
    }

    @Query()
    @Allow(Permission.Authenticated)
    async channelAuthConfig(@CtxParam() ctx: RequestContext, @Args() args: { channelId: string }) {
        this.assertChannelAccess(ctx, args.channelId);
        return this.authConfigService.getMasked(ctx, args.channelId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateChannelAuthConfig(
        @CtxParam() ctx: RequestContext,
        @Args() args: { channelId: string; input: any },
    ) {
        this.assertChannelAccess(ctx, args.channelId);
        return this.authConfigService.update(ctx, args.channelId, args.input);
    }
}
