import { CustomerService, ID, ListQueryBuilder, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { BalanceWithdrawalRequest } from './balance-withdrawal-request.entity';
export declare class BalanceWithdrawalService {
    private connection;
    private listQueryBuilder;
    private customerService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService);
    /**
     * 与 RechargeCardService.resolveCustomerId 同款口径：经 customerService.findOneByUserId
     * 把会话的 User.id 解析成 Customer.id，保证与既有余额键一致
     * （User.id vs Customer.id 混用会导致同一账户余额/流水分裂）。
     */
    private resolveCustomerId;
    myBalance(ctx: RequestContext): Promise<{
        balance: number;
        frozenBalance: number;
    }>;
    findMyRequests(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<PaginatedList<BalanceWithdrawalRequest>>;
    findAll(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        status?: string;
    }): Promise<PaginatedList<BalanceWithdrawalRequest>>;
    /**
     * 申请提现：原子条件扣减 balance 并入 frozenBalance（仿 distribution withdrawal.service.ts:77-90）。
     * 并发申请时只有余额仍充足的那笔能成功，避免「读余额 → 校验 → 写回」竞态多开提现单。
     */
    request(ctx: RequestContext, amount: number, method: 'wechat' | 'alipay' | 'bank', accountInfo: string): Promise<BalanceWithdrawalRequest>;
    /**
     * 审核状态流转：pending → approved → paid，pending/approved → rejected。
     * 用「带原状态条件的原子更新」完成流转（仿 distribution withdrawal.service.ts:114-138），
     * 保证并发或重复调用时只有一次能成功——否则重复 reject 会对同一笔提现二次回补余额。
     * 调用方（resolver）已包 @Transaction()，此处与余额变更同事务。
     */
    private transition;
    approve(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest>;
    /** 驳回：解冻回补 balance，写 UNFREEZE 流水（transition 只成功一次 → 不会重复回补） */
    reject(ctx: RequestContext, id: ID, remark?: string): Promise<BalanceWithdrawalRequest>;
    /** 打款完成：冻结出账（balance 不变，无流水） */
    markPaid(ctx: RequestContext, id: ID): Promise<BalanceWithdrawalRequest>;
}
