"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderCompletionProcess = void 0;
/**
 * 履约闭环：Delivered → Completed（交易完成终态）。
 * 通过 OrderStates 接口增强把 Completed 并入 OrderState 联合类型；
 * mergeTransitionDefinitions 会把 Delivered: {to:['Cancelled','Completed']} 与默认进程的
 * Delivered: {to:['Cancelled']} 做并集，其余状态转移保持默认进程原样。
 */
exports.orderCompletionProcess = {
    transitions: {
        Delivered: { to: ['Cancelled', 'Completed'] },
        Completed: { to: [] }, // 终态：不可回退
    },
};
//# sourceMappingURL=order-completion.process.js.map