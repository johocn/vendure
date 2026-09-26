"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAdministratorByUserId = findAdministratorByUserId;
exports.resolveTenantMember = resolveTenantMember;
exports.resolveTenantMembers = resolveTenantMembers;
// D47：`User.id → Administrator → TenantMember` 换键的唯一实现来源。
//
// 背景：`ctx.activeUserId` / `ctx.session.user.id` 是 **User.id**，而 `TenantMember.administratorId`
// 存的是 **Administrator.id**。两者在多数环境下不相等（生产实证：administrator.id=53 / userId=15），
// 直接用 `where: { administratorId: String(activeUserId) }` 查询恒不匹配，且**不报错**（fail-open/fail-silent）。
// 历史上此处已分叉出多份实现（D45 修守卫、stocktake 操作人另写一份），本文件收敛为单一来源，
// 所有调用点禁止再自行拼 `where: { administratorId: String(userId) }`。
const core_1 = require("@vendure/core");
const tenant_member_entity_1 = require("./tenant-member.entity");
/** User.id → Administrator（换键第一步；User.id 为空或账号无 Administrator 时返回 null） */
async function findAdministratorByUserId(ctx, connection, userId) {
    if (userId === undefined || userId === null || userId === '')
        return null;
    return connection.getRepository(ctx, core_1.Administrator).findOne({
        where: { user: { id: String(userId) } },
    });
}
/**
 * User.id → TenantMember。
 * - 传 channelId：按该渠道收口（大多数业务写读的口径，如 pick-batch / stocktake 的 tenantOf）。
 * - 不传：不限渠道，返回任意一条（仅供「是否存在关联」这类跨店判断）。
 */
async function resolveTenantMember(ctx, connection, userId, channelId) {
    const admin = await findAdministratorByUserId(ctx, connection, userId);
    if (!admin)
        return null;
    const where = { administratorId: String(admin.id) };
    if (channelId !== undefined && channelId !== null && channelId !== '')
        where.channelId = String(channelId);
    return connection.getRepository(ctx, tenant_member_entity_1.TenantMember).findOne({ where });
}
/** User.id → 该管理员在**全部渠道**的 TenantMember（登录/选店期需按 channelId 建映射时使用） */
async function resolveTenantMembers(ctx, connection, userId) {
    const admin = await findAdministratorByUserId(ctx, connection, userId);
    if (!admin)
        return [];
    return connection.getRepository(ctx, tenant_member_entity_1.TenantMember).find({
        where: { administratorId: String(admin.id) },
    });
}
//# sourceMappingURL=resolve-tenant-member.js.map