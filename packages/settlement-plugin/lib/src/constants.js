"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTLE_TRIGGER_STATES = exports.SETTLEMENT_PLUGIN_OPTIONS = exports.loggerCtx = void 0;
exports.loggerCtx = 'SettlementPlugin';
exports.SETTLEMENT_PLUGIN_OPTIONS = Symbol('SETTLEMENT_PLUGIN_OPTIONS');
/** completed 口径触发状态集合（本项目订单状态机：Shipped/Delivered/Completed）。 */
exports.SETTLE_TRIGGER_STATES = ['Shipped', 'Delivered', 'Completed'];
//# sourceMappingURL=constants.js.map