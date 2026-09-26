// D47：`User.id → Administrator → TenantMember` 换键的唯一实现来源。
//
// 背景：`ctx.activeUserId` / `ctx.session.user.id` 是 **User.id**，而 `TenantMember.administratorId`
// 存的是 **Administrator.id**。两者在多数环境下不相等（生产实证：administrator.id=53 / userId=15），
// 直接用 `where: { administratorId: String(activeUserId) }` 查询恒不匹配，且**不报错**（fail-open/fail-silent）。
// 历史上此处已分叉出多份实现（D45 修守卫、stocktake 操作人另写一份），本文件收敛为单一来源，
// 所有调用点禁止再自行拼 `where: { administratorId: String(userId) }`。
import { Administrator, RequestContext, TransactionalConnection } from '@vendure/core';
import { TenantMember } from './tenant-member.entity';

/** User.id → Administrator（换键第一步；User.id 为空或账号无 Administrator 时返回 null） */
export async function findAdministratorByUserId(
    ctx: RequestContext,
    connection: TransactionalConnection,
    userId: string | number | null | undefined,
): Promise<Administrator | null> {
    if (userId === undefined || userId === null || userId === '') return null;
    return connection.getRepository(ctx, Administrator).findOne({
        where: { user: { id: String(userId) } } as any,
    });
}

/**
 * User.id → TenantMember。
 * - 传 channelId：按该渠道收口（大多数业务写读的口径，如 pick-batch / stocktake 的 tenantOf）。
 * - 不传：不限渠道，返回任意一条（仅供「是否存在关联」这类跨店判断）。
 */
export async function resolveTenantMember(
    ctx: RequestContext,
    connection: TransactionalConnection,
    userId: string | number | null | undefined,
    channelId?: string | number | null,
): Promise<TenantMember | null> {
    const admin = await findAdministratorByUserId(ctx, connection, userId);
    if (!admin) return null;
    const where: any = { administratorId: String(admin.id) };
    if (channelId !== undefined && channelId !== null && channelId !== '') where.channelId = String(channelId);
    return connection.getRepository(ctx, TenantMember).findOne({ where });
}

/** User.id → 该管理员在**全部渠道**的 TenantMember（登录/选店期需按 channelId 建映射时使用） */
export async function resolveTenantMembers(
    ctx: RequestContext,
    connection: TransactionalConnection,
    userId: string | number | null | undefined,
): Promise<TenantMember[]> {
    const admin = await findAdministratorByUserId(ctx, connection, userId);
    if (!admin) return [];
    return connection.getRepository(ctx, TenantMember).find({
        where: { administratorId: String(admin.id) } as any,
    });
}
