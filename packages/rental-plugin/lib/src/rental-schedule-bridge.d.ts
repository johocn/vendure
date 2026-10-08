import { Injector, Order, RequestContext } from '@vendure/core';
import { RentalPlan } from './rental-plan.entity';
/**
 * 软依赖桥：运行时经 require + Injector.get 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null（租赁退化为普通订单支付）。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
export declare function tryGetScheduleService(injector: Injector): any | null;
/**
 * 结算页选择租赁（startRental）时生成期次实例：
 * - seq1 押金（deposit / security_deposit，date now → 立即可付；COD 不适用押金）
 * - prepaid：租金单项（rentAmount × periods，date now，与押金同时付）
 * - postpaid：租金 × periods（interval trigger，count = i，allowCod 按计划配置）
 * deliveryGate=deposit_paid（押金到账即可发货）；买断配置快照进 schedule.meta。
 * postpaid 各期 dueAt = 下单时间 + count × rentUnit（后付：先用电后付费，首期租金在租期 1 结束时到期；
 * 若届时货物尚未送达，COD 语义由运营侧保证——调度层只负责期次触发与 allowCod 放行）。
 */
export declare function createRentalSchedule(ctx: RequestContext, injector: Injector, order: Order, plan: RentalPlan, periods: number, graceHours: number): Promise<void>;
