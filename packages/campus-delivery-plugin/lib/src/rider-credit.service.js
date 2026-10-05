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
     * 读取在 rawConnection.transaction 内直读 customFields.riderCredit（与 grab 事务模式一致），更新/流水走 ctx 仓储。 */
    async adjust(ctx, customerId, delta, reason, orderId) {
        const next = await this.connection.rawConnection.transaction(async (em) => {
            var _a, _b;
            const customer = await em.getRepository(core_1.Customer).findOne({ where: { id: customerId } });
            const current = (_b = (_a = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _a === void 0 ? void 0 : _a.riderCredit) !== null && _b !== void 0 ? _b : 100;
            return Math.max(0, current + delta);
        });
        await this.connection.getRepository(ctx, core_1.Customer).update(customerId, {
            customFields: { riderCredit: next },
        });
        await this.connection.getRepository(ctx, rider_credit_log_entity_1.RiderCreditLog).save({
            customerId, delta, reason, orderId: orderId !== null && orderId !== void 0 ? orderId : null, channelId: ctx.channelId,
        });
        return next;
    }
};
exports.RiderCreditService = RiderCreditService;
exports.RiderCreditService = RiderCreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RiderCreditService);
//# sourceMappingURL=rider-credit.service.js.map