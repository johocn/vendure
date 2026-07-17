import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { RequestContext, Permission, Allow, Ctx } from '@vendure/core';
import { AuthConfigService } from '../auth/auth-config.service';
import { PayConfigService } from '../payment/pay-config.service';
import { MapConfigService } from '../map/map-config.service';
import { SsoProviderService } from '../auth/sso-provider.service';

class PermissionError extends Error {
    constructor(code: string) {
        super(code);
        this.name = 'PermissionError';
    }
}

@Injectable()
@Resolver()
export class TenantConfigAdminResolver {
    constructor(
        private authConfigService: AuthConfigService,
        private payConfigService: PayConfigService,
        private mapConfigService: MapConfigService,
        private ssoProviderService: SsoProviderService,
        @InjectConnection() private connection: Connection,
    ) {}

    private canEdit(ctx: RequestContext, channelId: string): boolean {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) return true;
        // Vendure API: ctx.session.user.channelPermissions 是 { id, token, code, permissions }[]
        const channelPermissions = (ctx as any).session?.user?.channelPermissions || [];
        return channelPermissions.some((c: any) => String(c.id) === String(channelId));
    }

    private assertCanWrite(ctx: RequestContext, channelId: string) {
        if (!this.canEdit(ctx, channelId)) throw new PermissionError('TENANT_CONFIG_FORBIDDEN');
    }

    @Query()
    @Allow(Permission.Authenticated)
    async tenantConfig(@Ctx() ctx: RequestContext, @Args() args: { channelId: string }) {
        // 读权限:super-admin 或关联 channel,无权限则抛错(与测试规格一致)
        this.assertCanWrite(ctx, args.channelId);
        const [auth, pay, map] = await Promise.all([
            this.authConfigService.getMasked(ctx, args.channelId),
            this.payConfigService.getMasked(ctx, args.channelId),
            this.mapConfigService.getMasked(ctx, args.channelId),
        ]);
        return { channelId: args.channelId, auth, pay, map, canEdit: true };
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateTenantConfig(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        const { channelId, authPatch, payPatch, mapPatch } = args.input;
        this.assertCanWrite(ctx, channelId);
        if (authPatch) await this.authConfigService.update(ctx, channelId, authPatch);
        if (payPatch) await this.payConfigService.update(ctx, channelId, payPatch);
        if (mapPatch) await this.mapConfigService.update(ctx, channelId, mapPatch);
        // 审计日志:用 query builder 直接插入(因 HistoryEntry 是 abstract 单表继承,不能 save 对象字面量)
        const operator = (ctx as any).session?.user?.identifier || ctx.activeUserId;
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
                createdAt: () => 'NOW()',
                updatedAt: () => 'NOW()',
                type: 'TENANT_CONFIG_UPDATE',
                isPublic: false,
                data: JSON.stringify({
                    channelId,
                    sections: [authPatch && 'auth', payPatch && 'pay', mapPatch && 'map'].filter(Boolean),
                    operator,
                }),
                discriminator: 'tenant-config',
            })
            .execute();
        return this.tenantConfig(ctx, { channelId });
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async testSsoConnection(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        const { channelId, providerKey, newClientSecret } = args.input;
        this.assertCanWrite(ctx, channelId);
        return this.ssoProviderService.testConnection(ctx, channelId, providerKey, newClientSecret);
    }
}
