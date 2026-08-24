import { RequestContext, ChannelService, TransactionalConnection } from '@vendure/core';
/**
 * 登录后返回当前后台用户的租户访问信息：
 * - channels：每个有权限的租户的启停状态（enabled）与该用户在该租户的人员启停（memberEnabled）
 * - permissions：当前用户在角色中累积的业务权限码（供前端菜单渲染）
 *   - 传入 channelId 时仅返回该 channel 对应角色限定的权限（按当前激活店铺渲染菜单），
 *     不传则返回跨 channel 并集（登录/选店阶段）。后端 API 授权由 ctx.userHasPermissions
 *     已按激活 channel 校验，此处仅影响前端菜单展示。
 */
export declare class MyAccessResolver {
    private channelService;
    private connection;
    constructor(channelService: ChannelService, connection: TransactionalConnection);
    myTenantAccess(ctx: RequestContext, channelId?: string): Promise<any>;
}
