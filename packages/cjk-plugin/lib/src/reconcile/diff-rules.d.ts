export type DiffType = 'D1' | 'D2' | 'D3' | 'D4';
export interface DiffOrderInput {
    order: {
        id: string;
        totalWithTax: number;
        state: string;
        customFields?: Record<string, any>;
    };
    deliveryRecords: Array<{
        mode: string;
        sourceLocationId: string | null;
        status: string;
    }>;
    ledgerOuts: Array<{
        sourceLocationId: string | null;
        quantity: number;
    }>;
    settlements: Array<{
        status: string;
        amount: number;
    }>;
    mirrorDiff: number;
    cancelled?: boolean;
}
/**
 * 四流逐单比对：
 * D1 缺配送记录：已发货/已交付订单必须有 mode∈{self,express,pickup} 且非 Draft 的记录
 * D2 扣仓不一致：账本 order:out 仓与配送记录 sourceLocationId 必须一致
 * D3 金额不平：台账应收合计（PAID 实收 + PENDING_SIGN 在途）≠ 订单应付；退款单跳过
 * D4 镜像不平：虚拟仓 onHand ≠ Σ 绑定物理仓 onHand（由批次扫描传入）
 */
export declare function diffOrder(input: DiffOrderInput): DiffType[];
