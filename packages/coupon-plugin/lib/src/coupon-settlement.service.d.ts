import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponSettlementOrder } from './coupon-settlement-order.entity';
import { InStoreBill } from './in-store-bill.entity';
/**
 * 券结算服务（买单券资金流 T1/T3 编排）：
 * - registerFromBill：核销（到店买单）成功后同步登记待结算单（幂等，失败不阻断核销）
 * - runSettlementCycle：T+1 汇总 job——① 兜底补登（唯一约束防重复出单）
 *   ② 提交分账（幂等键 = 结算单号，带原状态条件原子更新，风险铁律④）③ 回执推进
 * P0 结算口径：仅到店核销（InStoreBill）登记结算——线上订单核销的面额折算需订单级折扣捕获，
 * 与退款联动（T8）一并列入后续任务；线上券继续走原有订单资金流，不受本服务影响。
 */
export declare class CouponSettlementService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 佣金费率快照来源：环境变量 COUPON_SPLIT_COMMISSION_BP（万分比，默认 0 = 平台暂不分佣） */
    private commissionRateBp;
    /** T+1 界线：今天零点（核销发生在今天零点之前 = 已满一天，可提交分账） */
    private settlementCutoff;
    /**
     * 核销 → 待结算登记（幂等：customerCouponId 唯一约束）。
     * 在核销事务内调用；任何失败只记日志不抛错——核销是主流程，结算登记由 T+1 job 兜底补登。
     */
    registerFromBill(ctx: RequestContext, bill: InStoreBill, saleOrderId?: number | null): Promise<void>;
    /** T+1 汇总出单 + 提交分账 + 回执推进（供定时任务与 admin 手动触发共用；ctx 仅用于鉴权） */
    runSettlementCycle(): Promise<{
        submitted: number;
        promoted: number;
        failed: number;
    }>;
    /**
     * 兜底补登：核销成功但登记缺失（历史数据/登记异常）的到店买单 → 补 PENDING 结算单。
     * 查询条件全部下推 SQL（风险铁律②）：INNER JOIN 用户券限 saleOrderId 非空（只有出售券涉及分账），
     * LEFT JOIN 结算单排除已登记；日期用 TypeORM 参数绑定（Date 对象，驱动负责序列化，
     * SQLite/PG 口径一致——不做字符串手工比较，规避超时关单 e2e 的日期序列化前科）。
     */
    private backfillRegistrations;
    /**
     * 提交到期 PENDING 结算单（SQL 下推：status + T+1 界线 + 重试上限）。
     * 幂等：① submitSplit 幂等键 = 结算单号 ② 状态推进全部带原状态条件原子更新。
     */
    private submitDueRows;
    /** 回执推进：SETTLED → PAID_OUT（FINISHED）/ 退回 PENDING 重试（FAILED） */
    private promoteSettledRows;
    /** admin 流水查询（渠道强制隔离） */
    listSettlements(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        status?: string;
    }): Promise<{
        items: CouponSettlementOrder[];
        totalItems: number;
    }>;
    findSettlement(ctx: RequestContext, id: number): Promise<CouponSettlementOrder | undefined>;
    /** admin 手动触发（运维入口；鉴权在 resolver） */
    manualRunCycle(ctx: RequestContext): Promise<{
        submitted: number;
        promoted: number;
        failed: number;
    }>;
    /** 供退款联动（T8）预留的批量查询工具 */
    findSettlementsBySaleOrder(ctx: RequestContext, saleOrderIds: number[]): Promise<CouponSettlementOrder[]>;
}
