"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionRecordCreatedEvent = void 0;
const core_1 = require("@vendure/core");
/**
 * 生态钩子事件：直接佣金记录落库后由 CommissionService 发布。
 * 供外部插件（如 eco-plugin）订阅后上报 distribute 生态行为；
 * 事件发布失败不影响佣金主流程（发布处 try/catch 静默）。
 */
class CommissionRecordCreatedEvent extends core_1.VendureEvent {
    constructor(ctx, orderId, orderCode, 
    /** 获得直接佣金的 inviter（分销商）对应的 customer id */
    distributorCustomerId, commissionType) {
        super();
        this.ctx = ctx;
        this.orderId = orderId;
        this.orderCode = orderCode;
        this.distributorCustomerId = distributorCustomerId;
        this.commissionType = commissionType;
    }
}
exports.CommissionRecordCreatedEvent = CommissionRecordCreatedEvent;
//# sourceMappingURL=commission-record-created.event.js.map