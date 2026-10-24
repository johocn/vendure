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
exports.RiderCreditService = exports.CREDIT_LIMIT = exports.CREDIT_TIMEOUT = exports.CREDIT_REJECT = exports.CREDIT_COMPLETE = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const rider_credit_log_entity_1 = require("./rider-credit-log.entity");
exports.CREDIT_COMPLETE = 2;
exports.CREDIT_REJECT = -5;
exports.CREDIT_TIMEOUT = -10;
exports.CREDIT_LIMIT = 60;
let RiderCreditService = class RiderCreditService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 加减分 + 流水。下限 0。
     * 并发安全：单条 UPDATE 原子读改写（GREATEST 夹紧），避免并发 adjust 互相覆盖丢分。
     * 列名为 customFields 物理列（riderCredit → customFieldsRidercredit）。 */
    async adjust(ctx, customerId, delta, reason, orderId) {
        var _a, _b, _c;
        const rows = await this.connection.rawConnection.query('UPDATE "customer" SET "customFieldsRidercredit" = '
            + 'GREATEST(0, COALESCE("customFieldsRidercredit", 100) + $1) '
            + 'WHERE id = $2 RETURNING "customFieldsRidercredit" AS credit', [delta, customerId]);
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const next = Number((_b = (_a = list === null || list === void 0 ? void 0 : list[0]) === null || _a === void 0 ? void 0 : _a.credit) !== null && _b !== void 0 ? _b : (delta > 0 ? 100 + delta : 100));
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
};
exports.RiderCreditService = RiderCreditService;
exports.RiderCreditService = RiderCreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RiderCreditService);
//# sourceMappingURL=rider-credit.service.js.map