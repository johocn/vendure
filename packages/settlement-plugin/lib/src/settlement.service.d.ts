import { AdministratorService, ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { MerchantAccount } from './merchant-account.entity';
import { SettlementEntry } from './settlement-entry.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { ListOptions, SettlementPluginOptions, SettlementSummary } from './types';
/**
 * 商家财务对账编排：订单 completed 口径按店入账 + 提现流转。
 * 店主归属：Shop.administratorId（阶段18 账权），复用 manageOwnShop 权限。
 * 平台操作：@Allow(Permission.UpdateSettings)。
 */
export declare class SettlementService {
    private options;
    private connection;
    private orderService;
    private administratorService;
    constructor(options: SettlementPluginOptions, connection: TransactionalConnection, orderService: OrderService, administratorService: AdministratorService);
    /** 订单完成履结 → 按店入账（幂等：orderId×shopId unique，仅新建明细时累加账户）。 */
    handleOrderSettled(ctx: RequestContext, orderId: ID): Promise<void>;
    myAccount(ctx: RequestContext): Promise<MerchantAccount>;
    mySettlementEntries(ctx: RequestContext, options?: ListOptions): Promise<{
        items: SettlementEntry[];
        totalItems: number;
    }>;
    myWithdrawalRequests(ctx: RequestContext, options?: ListOptions): Promise<{
        items: WithdrawalRequest[];
        totalItems: number;
    }>;
    requestWithdrawal(ctx: RequestContext, amount: number): Promise<WithdrawalRequest>;
    mySettlementSummary(ctx: RequestContext, from?: Date, to?: Date): Promise<SettlementSummary>;
    accounts(ctx: RequestContext, options?: ListOptions): Promise<{
        items: MerchantAccount[];
        totalItems: number;
    }>;
    entriesByShop(ctx: RequestContext, shopId: ID, options?: ListOptions): Promise<{
        items: SettlementEntry[];
        totalItems: number;
    }>;
    allWithdrawalRequests(ctx: RequestContext, options?: ListOptions): Promise<{
        items: WithdrawalRequest[];
        totalItems: number;
    }>;
    approveWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    payWithdrawal(ctx: RequestContext, id: ID): Promise<WithdrawalRequest>;
    rejectWithdrawal(ctx: RequestContext, id: ID, note?: string): Promise<WithdrawalRequest>;
    setMerchantCommissionRate(ctx: RequestContext, shopId: ID, rate: number): Promise<MerchantAccount>;
    private getOrCreateAccount;
    private listEntries;
    private summary;
    private getWithdrawalOrThrow;
    private assertTransition;
    private requireMyShop;
    private resolveShopAggregation;
}
