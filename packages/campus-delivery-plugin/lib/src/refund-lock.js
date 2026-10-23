"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundLockKey = void 0;
exports.withRefundLock = withRefundLock;
/** 退款串行化锁键：商家拒单 / T4 无人接 / 运营异常处置 / 改址差额结清共用，按订单维度互斥 */
const refundLockKey = (orderId) => `campus:refund:${orderId}`;
exports.refundLockKey = refundLockKey;
/**
 * 在订单级咨询锁内执行退款复合动作（查已退总额 → 退差额 → 落记录）。
 * ok=false 表示该订单已有另一路退款在处理，调用方应提示重试或本轮跳过。
 * 锁由同一 QueryRunner 持有/释放，避免连接池换连接导致锁泄漏。
 */
async function withRefundLock(connection, orderId, fn) {
    var _a;
    const runner = connection.rawConnection.createQueryRunner();
    await runner.connect();
    const lockKey = (0, exports.refundLockKey)(orderId);
    try {
        const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
        const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
        if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
            return { ok: false };
        return { ok: true, value: await fn() };
    }
    finally {
        try {
            await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
        }
        catch (_b) {
            // 释放失败交给连接回收兜底
        }
        await runner.release();
    }
}
//# sourceMappingURL=refund-lock.js.map