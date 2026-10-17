"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuperAdminUser = getSuperAdminUser;
exports.createAdminCtx = createAdminCtx;
exports.withPlainCtx = withPlainCtx;
exports.withCtx = withCtx;
exports.runStage = runStage;
exports.logStage = logStage;
exports.yuanToCents = yuanToCents;
const core_1 = require("@vendure/core");
let cachedSuperAdminUser;
async function getSuperAdminUser(app) {
    if (cachedSuperAdminUser)
        return cachedSuperAdminUser;
    const conn = app.get(core_1.TransactionalConnection);
    const userRepo = conn.rawConnection.getRepository('User');
    const user = (await userRepo.findOne({
        where: { identifier: 'superadmin@china.test' },
        relations: ['roles', 'roles.channels'],
    }));
    if (!user)
        throw new Error('superadmin user not found');
    cachedSuperAdminUser = user;
    return user;
}
async function createAdminCtx(app, channelOrToken) {
    const ctxService = app.get(core_1.RequestContextService);
    const user = await getSuperAdminUser(app);
    return ctxService.create({ apiType: 'admin', channelOrToken, user });
}
async function withPlainCtx(app, channel, fn) {
    // 普通 ctx（无 user），仅用于 bootstrap 阶段创建 superadmin 用户本身
    const ctxService = app.get(core_1.RequestContextService);
    const ctx = await ctxService.create({ apiType: 'admin', channelOrToken: channel });
    await fn(ctx);
}
async function withCtx(app, channel, fn) {
    // 带 superadmin user 的 ctx，用于需要 admin 权限的操作
    const ctx = await createAdminCtx(app, channel);
    await fn(ctx);
}
async function runStage(name, fn) {
    const start = Date.now();
    try {
        await fn();
        return { name, ok: true, durationMs: Date.now() - start };
    }
    catch (e) {
        return { name, ok: false, durationMs: Date.now() - start, error: e.message };
    }
}
function logStage(stageIndex, total, result) {
    const status = result.ok ? 'OK' : 'FAIL';
    const duration = (result.durationMs / 1000).toFixed(1);
    const prefix = `[${stageIndex}/${total}] ${result.name} ... ${status} (${duration}s)`;
    console.log(result.ok ? prefix : `${prefix}\n  ERROR: ${result.error}`);
}
function yuanToCents(yuan) {
    return Math.round(yuan * 100);
}
//# sourceMappingURL=shared.js.map