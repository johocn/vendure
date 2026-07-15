// e:\code\vendure\packages\cjk-plugin\src\auth\auth-admin.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { RequestContext, Ctx, ChannelService } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { parseAndDecryptStruct, maskAuthConfig, mergeAuthConfig, serializeAuthConfigToStruct } from './crypto';
import type { TenantAuthConfigMasked } from './auth-config.types';

@Resolver()
export class AuthAdminResolver {
    constructor(@Inject(ChannelService) private channelService: ChannelService) {}

    @Query()
    async channelAuthConfig(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string },
    ): Promise<TenantAuthConfigMasked | null> {
        const channel = await this.channelService.findOne(ctx, args.channelId as any);
        if (!channel) return null;
        const rawStruct = (channel as any).customFields?.authConfig;
        if (!rawStruct) return null;
        const domain = parseAndDecryptStruct(rawStruct);
        return maskAuthConfig(domain) as TenantAuthConfigMasked;
    }

    @Mutation()
    async updateChannelAuthConfig(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string; input: any },
    ): Promise<boolean> {
        const channel = await this.channelService.findOne(ctx, args.channelId as any);
        if (!channel) return false;
        const originalStruct = (channel as any).customFields?.authConfig;
        const originalDomain = originalStruct ? parseAndDecryptStruct(originalStruct) : null;
        // input 是 domain 形状（含 *** 表示保留原值）
        const merged = mergeAuthConfig(originalDomain, args.input);
        const newStruct = serializeAuthConfigToStruct(merged);
        await this.channelService.update(ctx, {
            id: args.channelId as any,
            customFields: { authConfig: newStruct },
        });
        return true;
    }
}
