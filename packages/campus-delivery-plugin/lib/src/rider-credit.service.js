"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderCreditService = exports.CREDIT_RECOVERY_CAP = exports.CREDIT_RECOVERY_DELTA = exports.CREDIT_RECOVERY_DAYS = exports.CREDIT_LIMIT = exports.CREDIT_TIMEOUT = exports.CREDIT_REJECT = exports.CREDIT_COMPLETE = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const rider_credit_log_entity_1 = require("./rider-credit-log.entity");
exports.CREDIT_COMPLETE = 2;
exports.CREDIT_REJECT = -5;
exports.CREDIT_TIMEOUT = -10;
exports.CREDIT_LIMIT = 60;
/** 自动恢复周期：7 天没超时扣分 +5 分，封顶 100 */
exports.CREDIT_RECOVERY_DAYS = 7;
exports.CREDIT_RECOVERY_DELTA = 5;
exports.CREDIT_RECOVERY_CAP = 100;
/** 单 channel 单轮恢复上限（防长事务） */
const RECOVERY_LIMIT = 200;
let RiderCreditService = class RiderCreditService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    async adjust(ctx, customerId, delta, reason, orderId) {
        var _a, _b, _c;
        const clamp = delta > 0
            ? 'LEAST(' + exports.CREDIT_RECOVERY_CAP + ', COALESCE("customFieldsRidercredit", 100) + $1)'
            : 'GREATEST(0, COALESCE("customFieldsRidercredit", 100) + $1)';
        const rows = await this.connection.rawConnection.query('UPDATE "customer" SET "customFieldsRidercredit" = ' + clamp
            + ' WHERE id = $2 RETURNING "customFieldsRidercredit" AS credit', [delta, customerId]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        // 无匹配行（顾客不存在）时回退默认值，同样要夹在 0-100 之间
        const fallback = Math.min(exports.CREDIT_RECOVERY_CAP, Math.max(0, 100 + delta));
        const next = Number((_b = (_a = list === null || list === void 0 ? void 0 : list[0]) === null || _a === void 0 ? void 0 : _a.credit) !== null && _b !== void 0 ? _b : fallback);
        try {
            await this.connection.getRepository(ctx, rider_credit_log_entity_1.RiderCreditLog).save({
                customerId, delta, reason, orderId: orderId !== null && orderId !== void 0 ? orderId : null, channelId: ctx.channelId,
            });
        }
        catch (e) {
            // 分数已原子更新无法回滚：流水失败不能让调用方误以为整体失败（会重复加减分），
            // 但必须留告警，否则分数变动无流水可查。
            core_1.Logger.warn(`rider credit log save failed customer=${customerId} delta=${delta} reason=${reason}: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, 'CampusCredit');
        }
        return next;
    }
    /** 骑手信用自动恢复：7 天没 timeout 扣分且 7 天内未恢复过的骑手 credit<100 时 +5 分。
     *  每轮 dispatch sweep 每 channel 扫一次，每轮最多恢复 RECOVERY_LIMIT 人防长事务。
     *  去重：同一骑手 7 天内最多恢复一次（否则 sweep 每分钟一轮会把信用分一路刷回 100）。
     *  并发安全：每个 customerId 单独 adjust 原子 UPDATE + 流水。
     *  注意：rider_credit_log 物理列是带引号的 camelCase（"customerId"/"channelId"），
     *  原生 SQL 内必须加双引号，否则 PG 折叠成小写报 column "customerid" does not exist。 */
    async sweepRecovery(ctx) {
        const since = new Date(Date.now() - exports.CREDIT_RECOVERY_DAYS * 86400000);
        // 排除近 7 天有 timeout_not_picked 扣分记录的骑手；同时排除近 7 天已恢复过的骑手
        const rows = await this.connection.rawConnection.query(`SELECT DISTINCT c.id FROM "customer" c
             WHERE c."customFieldsRidercredit" IS NOT NULL
               AND c."customFieldsRidercredit" < ${exports.CREDIT_RECOVERY_CAP}
               AND c.id IN (
                   SELECT DISTINCT "customerId" FROM rider_credit_log
                   WHERE "channelId" = $1
               )
               AND NOT EXISTS (
                   SELECT 1 FROM rider_credit_log log
                   WHERE log."customerId" = c.id
                     AND log."channelId" = $1
                     AND log.reason = 'timeout_not_picked'
                     AND log."createdAt" >= $2
               )
               AND NOT EXISTS (
                   SELECT 1 FROM rider_credit_log rec
                   WHERE rec."customerId" = c.id
                     AND rec."channelId" = $1
                     AND rec.reason = 'recovery_7d_clean'
                     AND rec."createdAt" >= $2
               )
             LIMIT ${RECOVERY_LIMIT}`, [ctx.channelId, since]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        let recovered = 0;
        for (const r of list) {
            const id = Number(r.id);
            try {
                await this.adjust(ctx, id, exports.CREDIT_RECOVERY_DELTA, 'recovery_7d_clean');
                recovered++;
            }
            catch (e) {
                core_1.Logger.warn(`credit recovery failed rider=${id}: ${e === null || e === void 0 ? void 0 : e.message}`, 'CampusCredit');
            }
        }
        if (recovered > 0) {
            core_1.Logger.info(`credit recovery channel=${ctx.channelId}: +${recovered} rider(s) +${exports.CREDIT_RECOVERY_DELTA}pt`, 'CampusCredit');
        }
        return recovered;
    }
};
exports.RiderCreditService = RiderCreditService;
exports.RiderCreditService = RiderCreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RiderCreditService);
//# sourceMappingURL=rider-credit.service.js.map