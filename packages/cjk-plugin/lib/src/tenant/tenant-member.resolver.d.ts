import { RequestContext, RoleService, TransactionalConnection } from '@vendure/core';
import { TenantMemberService } from './tenant-member.service';
import { TenantMember } from './tenant-member.entity';
/**
 * 租户管理员 API：所有操作强制限定在 ctx.channelId（当前请求租户）。
 */
export declare class TenantMemberResolver {
    private roleService;
    private connection;
    private tenantMemberService;
    constructor(roleService: RoleService, connection: TransactionalConnection, tenantMemberService: TenantMemberService);
    tenantMembers(ctx: RequestContext): Promise<TenantMember[]>;
    createTenantMember(ctx: RequestContext, args: {
        input: any;
    }): Promise<TenantMember>;
    setTenantMemberEnabled(ctx: RequestContext, args: {
        id: string;
        enabled: boolean;
    }): Promise<TenantMember>;
    deleteTenantMember(ctx: RequestContext, id: string): Promise<boolean>;
    myTenantRoles(ctx: RequestContext): Promise<any[]>;
    myCreateTenantRole(ctx: RequestContext, args: {
        input: {
            code: string;
            description: string;
            permissions: string[];
        };
    }): Promise<any>;
    myUpdateTenantRole(ctx: RequestContext, args: {
        roleId: string;
        input: any;
    }): Promise<any>;
    myDeleteTenantRole(ctx: RequestContext, roleId: string): Promise<boolean>;
}
