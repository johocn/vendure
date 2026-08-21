export const loggerCtx = 'SettlementPlugin';
export const SETTLEMENT_PLUGIN_OPTIONS = Symbol('SETTLEMENT_PLUGIN_OPTIONS');
/** completed 口径触发状态集合（本项目订单状态机：Shipped/Delivered/Completed）。 */
export const SETTLE_TRIGGER_STATES = ['Shipped', 'Delivered', 'Completed'];