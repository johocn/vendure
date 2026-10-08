"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetScheduleService = tryGetScheduleService;
exports.createRentalSchedule = createRentalSchedule;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 软依赖桥：运行时经 require + Injector.get 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null（租赁退化为普通订单支付）。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
function tryGetScheduleService(injector) {
    var _a;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PaymentScheduleService } = require('@vendure/payment-schedule-plugin');
        // Vendure Injector.get 内部即 moduleRef.get(token, { strict: false })，无需再传 options（同 installment 桥）
        return (_a = injector.get(PaymentScheduleService)) !== null && _a !== void 0 ? _a : null;
    }
    catch (_b) {
        return null;
    }
}
/**
 * 结算页选择租赁（startRental）时生成期次实例：
 * - seq1 押金（deposit / security_deposit，date now → 立即可付；COD 不适用押金）
 * - prepaid：租金单项（rentAmount × periods，date now，与押金同时付）
 * - postpaid：租金 × periods（interval trigger，count = i，allowCod 按计划配置）
 * deliveryGate=deposit_paid（押金到账即可发货）；买断配置快照进 schedule.meta。
 * postpaid 各期 dueAt = 下单时间 + count × rentUnit（后付：先用电后付费，首期租金在租期 1 结束时到期；
 * 若届时货物尚未送达，COD 语义由运营侧保证——调度层只负责期次触发与 allowCod 放行）。
 */
async function createRentalSchedule(ctx, injector, order, plan, periods, graceHours) {
    var _a, _b;
    const scheduleService = tryGetScheduleService(injector);
    if (!scheduleService)
        return;
    if ((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.paymentScheduleId)
        return; // 幂等
    try {
        const now = new Date();
        const items = [
            {
                seq: 1,
                kind: 'deposit',
                amount: plan.depositAmount,
                trigger: { type: 'date', at: now.toISOString() },
                graceHours,
            },
        ];
        if (plan.prepaidOrPostpaid === 'prepaid') {
            items.push({
                seq: 2,
                kind: 'rent',
                amount: plan.rentAmount * periods,
                trigger: { type: 'date', at: now.toISOString() },
                graceHours,
            });
        }
        else {
            for (let i = 1; i <= periods; i++) {
                items.push({
                    seq: i + 1,
                    kind: 'rent',
                    amount: plan.rentAmount,
                    allowCod: plan.allowCod,
                    trigger: { type: 'interval', unit: plan.rentUnit, count: i, anchor: 'order_placed' },
                    graceHours,
                });
            }
        }
        await scheduleService.createSchedule(ctx, {
            orderId: order.id,
            scenario: 'rental',
            deliveryGate: 'deposit_paid',
            depositRule: { kind: 'security_deposit' },
            agreementVersion: 'v1',
            // 买断配置下单快照（改配置不影响已生成订单）
            meta: {
                rental: {
                    buyoutPrice: (_b = plan.buyoutPrice) !== null && _b !== void 0 ? _b : null,
                    allowBuyout: plan.allowBuyout && plan.buyoutPrice != null,
                },
            },
            items,
        });
        core_1.Logger.info(`Rental schedule created for order ${order.code} (plan ${plan.id}, ${periods} period(s))`, constants_1.loggerCtx);
    }
    catch (e) {
        core_1.Logger.error(`createRentalSchedule failed for order ${order.code}: ${e.message}`, constants_1.loggerCtx);
        throw e;
    }
}
