import { Administrator, Customer, StockLocation } from '@vendure/core';
import { PosTerminal } from './pos-terminal.entity';
/**
 * 班次状态：open=开班中，closed=已关班
 */
export type PosSessionState = 'open' | 'closed';
/**
 * 关班时生成的对账单快照（由 ShiftReportService 在 Task 6 生成，此处先用 any 兜底）
 */
export type ShiftSummary = {
    orders: {
        totalCount: number;
        totalAmount: number;
        normalCount: number;
        refundCount: number;
        refundAmount: number;
        heldCount: number;
    };
    paymentsByMethod: Array<{
        method: string;
        count: number;
        amount: number;
    }>;
    warnings: string[];
};
export declare class PosSession {
    id: number;
    code: string;
    terminal: PosTerminal;
    stockLocation: StockLocation;
    operator: Administrator;
    approver: Administrator | null;
    state: PosSessionState;
    openedAt: Date;
    closedAt: Date | null;
    closeSummary: ShiftSummary | null;
    openingFloat: number;
    closingCash: number;
    activeOrderId: number | null;
    /**
     * 当前绑定的会员 ID（可空，未绑定会员时为 null）。
     * POS 收银员通过会员识别 API 绑定，加购时自动应用会员价。
     */
    customerId: number | null;
    customer: Customer | null;
    updatedAt: Date;
}
