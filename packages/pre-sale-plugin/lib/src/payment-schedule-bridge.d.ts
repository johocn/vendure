import { Injector, Order, RequestContext } from '@vendure/core';
import { PreSaleActivity } from './pre-sale-activity.entity';
/**
 * 软依赖桥：运行时经 require + Injector.get(strict:false) 获取 payment-schedule-plugin 调度服务。
 * 未启用/未注册 → 返回 null，pre-sale 回退旧行为（无期次）。
 * 跨插件一律用构建后 lib 包名 require（工程约定 0.3：规避类身份不一致）。
 */
export declare function tryGetScheduleService(injector: Injector): any | null;
/**
 * 下单（applyPreSale）时生成期次实例：
 * - full：单 balance 项（首期立即可付）
 * - deposit：deposit + balance 双项；尾款期 trigger 按活动 tailTriggerType
 * 生成失败仅告警不阻断抢购（期次缺失时薄壳回退旧支付路径）。
 */
export declare function createScheduleForOrder(ctx: RequestContext, injector: Injector, order: Order, activity: PreSaleActivity): Promise<void>;
