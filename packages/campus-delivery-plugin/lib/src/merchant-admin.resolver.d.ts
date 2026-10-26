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
    /** 商家侧顾客联系方式（号码保护）：开启后仅返回脱敏/虚拟号 */
    campusMerchantCustomerContact(ctx: RequestContext, orderId: ID): Promise<import("./privacy-number.service").PrivacyContact>;
    campusMerchantCookingDone(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 商家拒单/缺货：全额退款并取消订单（接单前或备餐中可用） */
    campusMerchantRejectOrder(ctx: RequestContext, orderId: ID, reason: string): Promise<{
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
    /** 一键沽清：本店商品列表（含售罄标记） */
    campusMerchantProducts(ctx: RequestContext, search?: string, skip?: number, take?: number): Promise<{
        items: any;
        total: number;
    }>;
    /** 沽清 / 取消沽清（售罄仍展示、不可加购） */
    campusMerchantSetProductSoldOut(ctx: RequestContext, productId: ID, soldOut: boolean): Promise<{
        ok: boolean;
        soldOut: boolean;
    }>;
    /** 商品级打包费（分/件）：null 清除回落店铺配置 */
    campusMerchantSetProductPackingFee(ctx: RequestContext, productId: ID, packingFee?: number | null): Promise<{
        ok: boolean;
        packingFee: number | null;
    }>;
    /** 商品加料组（P1-2）：传空数组清除 */
    campusMerchantSetProductAddonGroups(ctx: RequestContext, productId: ID, groups: string[]): Promise<{
        ok: boolean;
        addonGroups: string | null;
    }>;
    /** 商品套餐内容（P1-2）：传 null 清除 */
    campusMerchantSetProductCombo(ctx: RequestContext, productId: ID, combo?: string | null): Promise<{
        ok: boolean;
        combo: string | null;
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
