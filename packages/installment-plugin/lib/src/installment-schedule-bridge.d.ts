import { Injector, Order, RequestContext } from '@vendure/core';
import { InstallmentPlan } from './installment-plan.entity';
/**
 * 软依赖桥：运行时经 require + Injector.get 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null，分期退化为普通订单支付。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
export declare function tryGetScheduleService(injector: Injector): any | null;
/**
 * 结算页选择分期（enableInstallment）时生成期次实例：
 * 首付项（down_payment，ratio>0 时）+ N 期 installment（interval trigger）。
 * deliveryGate=first_period（付首付即可发货）；depositRule=down_payment（无罚则）。
 */
export declare function createInstallmentSchedule(ctx: RequestContext, injector: Injector, order: Order, plan: InstallmentPlan, graceHours: number): Promise<void>;
