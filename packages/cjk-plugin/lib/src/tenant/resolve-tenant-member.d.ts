import { Administrator, RequestContext, TransactionalConnection } from '@vendure/core';
import { TenantMember } from './tenant-member.entity';
/** User.id → Administrator（换键第一步；User.id 为空或账号无 Administrator 时返回 null） */
export declare function findAdministratorByUserId(ctx: RequestContext, connection: TransactionalConnection, userId: string | number | null | undefined): Promise<Administrator | null>;
/**
 * User.id → TenantMember。
 * - 传 channelId：按该渠道收口（大多数业务写读的口径，如 pick-batch / stocktake 的 tenantOf）。
 * - 不传：不限渠道，返回任意一条（仅供「是否存在关联」这类跨店判断）。
 */
export declare function resolveTenantMember(ctx: RequestContext, connection: TransactionalConnection, userId: string | number | null | undefined, channelId?: string | number | null): Promise<TenantMember | null>;
/** User.id → 该管理员在**全部渠道**的 TenantMember（登录/选店期需按 channelId 建映射时使用） */
export declare function resolveTenantMembers(ctx: RequestContext, connection: TransactionalConnection, userId: string | number | null | undefined): Promise<TenantMember[]>;
