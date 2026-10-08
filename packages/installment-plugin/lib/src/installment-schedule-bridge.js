"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetScheduleService = tryGetScheduleService;
exports.createInstallmentSchedule = createInstallmentSchedule;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 软依赖桥：运行时经 require + Injector.get 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null，分期退化为普通订单支付。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
function tryGetScheduleService(injector) {
    var _a;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PaymentScheduleService } = require('@vendure/payment-schedule-plugin');
        // Vendure Injector.get 内部即 moduleRef.get(token, { strict: false })，无需再传 options（同 pre-sale 桥）
        return (_a = injector.get(PaymentScheduleService)) !== null && _a !== void 0 ? _a : null;
    }
    catch (_b) {
        return null;
    }
}
/**
 * 结算页选择分期（enableInstallment）时生成期次实例：
 * 首付项（down_payment，ratio>0 时）+ N 期 installment（interval trigger）。
 * deliveryGate=first_period（付首付即可发货）；depositRule=down_payment（无罚则）。
 */
async function createInstallmentSchedule(ctx, injector, order, plan, graceHours) {
    var _a;
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService)
        return;
    if ((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.paymentScheduleId)
        return; // 幂等
    try {
        // Task 2 实装签名：(total, downRatioPercent, periods) → [首付, 期1..期n]
        // （首付=floor(total*ratio%)，余款均分、余数并入末期）——金额语义与计划一致
        const { splitInstallmentAmounts } = require('@vendure/payment-schedule-plugin');
        const [down, ...amounts] = splitInstallmentAmounts(order.totalWithTax, plan.downPaymentRatio, plan.periods);
        const now = new Date();
        const items = [];
        let seq = 1;
        if (down > 0) {
            items.push({
                seq: seq++,
                kind: 'down_payment',
                amount: down,
                trigger: { type: 'date', at: now.toISOString() },
                graceHours,
            });
        }
        amounts.forEach((amount, i) => {
            items.push({
                seq: seq++,
                kind: 'installment',
                amount,
                allowCod: plan.allowCod,
                trigger: {
                    type: 'interval',
                    unit: plan.intervalUnit,
                    count: plan.intervalCount * (i + 1),
                    anchor: 'order_placed',
                },
                graceHours,
            });
        });
        await scheduleService.createSchedule(ctx, {
            orderId: order.id,
            scenario: 'installment',
            deliveryGate: 'first_period',
            depositRule: { kind: 'down_payment' },
            agreementVersion: 'v1',
            items,
        });
        core_1.Logger.info(`Installment schedule created for order ${order.code} (plan ${plan.id})`, constants_1.loggerCtx);
    }
    catch (e) {
        core_1.Logger.error(`createInstallmentSchedule failed for order ${order.code}: ${e.message}`, constants_1.loggerCtx);
        throw e;
    }
}
