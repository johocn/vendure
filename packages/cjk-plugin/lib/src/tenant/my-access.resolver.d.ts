import { RequestContext, ChannelService, TransactionalConnection } from '@vendure/core';
/**
 * 登录后返回当前后台用户的租户访问信息：
 * - channels：每个有权限的租户的启停状态（enabled）与该用户在该租户的人员启停（memberEnabled）
 * - permissions：当前用户在所有角色中累积的业务权限码（供前端菜单渲染）
 */
export declare class MyAccessResolver {
    private channelService;
    private connection;
    constructor(channelService: ChannelService, connection: TransactionalConnection);
    myTenantAccess(ctx: RequestContext): Promise<any>;
}
