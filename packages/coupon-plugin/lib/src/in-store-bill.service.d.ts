import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponService } from './coupon.service';
import { InStoreBill } from './in-store-bill.entity';
/** 核销表单试算返回（金额单位：分；originalAmount 省略时金额字段为 null，仅回券信息） */
export interface InStoreBillQuote {
    ok: boolean;
    reason?: string | null;
    couponCode?: string | null;
    couponName?: string | null;
    discountType?: string | null;
    discountValue?: number | null;
    minSpend?: number | null;
    originalAmount?: number | null;
    discountAmount?: number | null;
    finalAmount?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
    expiresAt?: Date | null;
}
/** 流水查询条件 */
export interface InStoreBillListOptions {
    skip?: number;
    take?: number;
    couponCode?: string;
    from?: Date;
    to?: Date;
}
export declare class InStoreBillService {
    private connection;
    private couponService;
    constructor(connection: TransactionalConnection, couponService: CouponService);
    /**
     * 券码 → 可用到店买单券（校验顺序见 spec §7）：
     * 存在 → 模板启用 → 未使用 → 未过期 → 场景含 IN_STORE → 渠道归属 → 属店权限。
     * 失败不抛错，返回原因码（quote 用；redeem 再转为 UserInputError）。
     */
    private locate;
    /** 核销表单试算：originalAmount 省略 → 仅回券信息；否则回试算金额 */
    quote(ctx: RequestContext, code: string, originalAmount?: number | null): Promise<InStoreBillQuote>;
    /**
     * 到店买单核销：校验 → 原子占用（仅 UNUSED 可置 USED）→ 写流水。
     * 需在 @Transaction() 内调用。
     */
    redeem(ctx: RequestContext, code: string, originalAmount: number, remark?: string): Promise<InStoreBill>;
    /** 流水列表：按当前渠道强制隔离 + 券码/时间筛选 + 时间倒序分页 */
    list(ctx: RequestContext, options?: InStoreBillListOptions): Promise<{
        items: InStoreBill[];
        totalItems: number;
    }>;
    /** 流水汇总：笔数 / 原价合计 / 优惠合计 / 实收合计（金额单位：分） */
    summary(ctx: RequestContext, options?: {
        from?: Date;
        to?: Date;
    }): Promise<{
        count: number;
        originalTotal: number;
        discountTotal: number;
        finalTotal: number;
    }>;
    /** 流水查询基座：渠道隔离 + 可选筛选（list / summary 共用） */
    private buildBillsQuery;
    /** 顾客姓名/手机号快照（查询失败不阻断核销） */
    private loadCustomerInfo;
    /** 核销人名称快照（查询失败不阻断核销） */
    private resolveOperatorName;
}
