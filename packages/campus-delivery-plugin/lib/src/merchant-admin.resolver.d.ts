import { ID, RequestContext } from '@vendure/core';
import { MerchantAdminService } from './merchant-admin.service';
export declare class MerchantAdminResolver {
    private merchant;
    constructor(merchant: MerchantAdminService);
    /** 商家接单工作台看板：本渠道待接单/备餐中/待取货/配送中 + 今日完成 */
    campusMerchantBoard(ctx: RequestContext): Promise<import("./merchant-admin.service").MerchantBoard>;
    campusMerchantAcceptOrder(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    campusMerchantCookingDone(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 营业中开关（本渠道 paused） */
    campusMerchantSetPaused(ctx: RequestContext, paused: boolean): Promise<{
        ok: boolean;
    }>;
    /** 小票打印回执：打印成功后回写 waimaiPrintedAt（防重打 + 补打依据） */
    campusMerchantMarkPrinted(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 推送外部快递：provider = dada | meituan（由运营中心在派单时选择） */
    campusMerchantDispatchExternal(ctx: RequestContext, orderId: ID, provider: string): Promise<{
        ok: boolean;
        already: boolean;
        thirdPartyNo: any;
        provider?: undefined;
    } | {
        ok: boolean;
        thirdPartyNo: any;
        provider: import("./route-matrix").ExternalProviderCode;
        already?: undefined;
    }>;
    /** 取消外部快递（改推另一家前先取消，或运力失败回落） */
    campusMerchantCancelExternal(ctx: RequestContext, orderId: ID, reason?: string): Promise<{
        ok: boolean;
        skipped: boolean;
        reason?: undefined;
    } | {
        ok: boolean;
        reason: string | undefined;
        skipped?: undefined;
    }>;
    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    campusMerchantAcceptOwned(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** R1：商户送达校园交接点（之后由传信者接力） */
    campusMerchantMarkHandoverArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
    /** 自营快递送达：R1/R2 到交接点，R3 到学生 */
    campusMerchantMarkOwnedArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
}
