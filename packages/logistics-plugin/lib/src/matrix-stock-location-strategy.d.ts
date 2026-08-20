import { Injector, LocationWithQuantity, OrderLine, RequestContext, StockLocation } from '@vendure/core';
import { NearestStockLocationStrategy } from './nearest-stock-location-strategy';
/**
 * 库存策略矩阵：单一全局 StockLocationStrategy。
 * 继承 NearestStockLocationStrategy（含 MultiChannel 库存核算 + 服务范围门禁 + 自提锚点），
 * 在下单分配时按 渠道 × 配送方式 × 会员等级 判定规则，产出排序后的候选仓后交给父类扣减，
 * 天然产出多仓 LocationWithQuantity[]（余量拆单）。
 */
export declare class MatrixStockLocationStrategy extends NearestStockLocationStrategy {
    private entityHydrator;
    private stockLevelService;
    init(injector: Injector): Promise<void>;
    forAllocation(ctx: import('@vendure/core').RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<import('@vendure/core').LocationWithQuantity[]>;
    /**
     * 覆写 forSale：按「分配量 − 已售量」匹配剩余发货仓。
     *
     * 默认实现 getLocationsBasedOnAllocations 按 Allocation 顺序贪心分配，
     * 多仓分批发货时（如 P1 发 B仓5 件、P2 发 A仓3 件），第二次传入 quantity=3
     * 仍从首个 Allocation 仓（B仓）开始扣减，导致 Sale 归属和库存扣减错仓。
     *
     * 本覆写先扣除已创建的 Sale 记录，仅对剩余未售分配量匹配本次请求数量，
     * 确保每批发货的 Sale 正确归属对应仓库。首批发货时无已售记录，行为与基类一致。
     */
    forSale(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    /** 按矩阵优先级判定规则：member > shippingStrategy > 默认就近 */
    private decideRule;
    /** 读取订单 Customer 的会员等级（LV1..LV5），未登录/无等级按 LV1 */
    private resolveMemberLevel;
    private loadOrder;
    private readAnchor;
    /** 将拆分明细写入 OrderLine.stockLocationsJson（Task 2 提供字段），同时保留主仓 stockLocationId */
    private persistSplitDetail;
}
