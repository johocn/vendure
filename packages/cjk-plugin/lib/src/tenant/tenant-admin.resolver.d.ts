import { RequestContext, ChannelService, TransactionalConnection } from '@vendure/core';
import { TenantMemberService } from './tenant-member.service';
import { TenantMember } from './tenant-member.entity';
export declare class TenantAdminResolver {
    private channelService;
    private connection;
    private tenantMemberService;
    constructor(channelService: ChannelService, connection: TransactionalConnection, tenantMemberService: TenantMemberService);
    tenants(ctx: RequestContext, args: {
        options: {
            skip?: number;
            take?: number;
            filter?: any;
        };
    }): Promise<{
        items: any[];
        totalItems: number;
    }>;
    tenant(ctx: RequestContext, id: string): Promise<any>;
    createTenant(ctx: RequestContext, args: {
        input: {
            name: string;
            token?: string;
            isOfficial?: boolean;
        };
    }): Promise<any>;
    updateTenant(ctx: RequestContext, args: {
        id: string;
        input: {
            name?: string;
            tenantNo?: number;
            isOfficial?: boolean;
        };
    }): Promise<any>;
    setTenantEnabled(ctx: RequestContext, args: {
        id: string;
        enabled: boolean;
    }): Promise<any>;
    /** 软删：标记停用，不做物理删除 */
    deleteTenant(ctx: RequestContext, id: string): Promise<boolean>;
    tenantAdministrators(ctx: RequestContext, channelId: string): Promise<TenantMember[]>;
    createTenantAdministrator(ctx: RequestContext, args: {
        channelId: string;
        input: any;
    }): Promise<TenantMember>;
    setTenantAdministratorEnabled(ctx: RequestContext, args: {
        id: string;
        enabled: boolean;
    }): Promise<TenantMember>;
    deleteTenantAdministrator(ctx: RequestContext, id: string): Promise<boolean>;
    tenantRoles(ctx: RequestContext, channelId: string): Promise<any[]>;
    createTenantRole(ctx: RequestContext, args: {
        channelId: string;
        input: {
            code: string;
            description: string;
            permissions: string[];
        };
    }): Promise<any>;
    updateTenantRole(ctx: RequestContext, args: {
        roleId: string;
        input: {
            code?: string;
            description?: string;
            permissions?: string[];
        };
    }): Promise<any>;
    deleteTenantRole(ctx: RequestContext, roleId: string): Promise<boolean>;
    updateTenantMemberRoles(ctx: RequestContext, args: {
        id: string;
        channelId: string;
        roleIds: string[];
    }): Promise<boolean>;
    tenantSearchAdmins(ctx: RequestContext, args: {
        channelId: string;
        keyword?: string;
    }): Promise<any[]>;
    tenantLinkMember(ctx: RequestContext, args: {
        channelId: string;
        administratorId: string;
        roleIds?: string[];
        displayName?: string;
        phone?: string;
        remark?: string;
    }): Promise<any>;
    importDefaultRoles(ctx: RequestContext, channelId: string): Promise<any[]>;
    globalRoles(ctx: RequestContext): Promise<any[]>;
    createGlobalRole(ctx: RequestContext, args: {
        channelIds: string[];
        input: {
            code: string;
            description: string;
            permissions: string[];
        };
    }): Promise<any[]>;
    referGlobalRoleToChannel(ctx: RequestContext, args: {
        roleId: string;
        channelId: string;
    }): Promise<boolean>;
    unreferGlobalRoleFromChannel(ctx: RequestContext, args: {
        roleId: string;
        channelId: string;
    }): Promise<boolean>;
}
