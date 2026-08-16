import { ChannelService } from '@vendure/core';
import { SettlementService } from '../settlement.service';
/**
 * 商家对账 / 订单查询 REST API。
 *
 * 鉴权：校验 `Authorization: Bearer <channelToken>`，其中 channelToken 即该商家
 * Channel 的 token（注册商家时生成，格式如 `${shopCode}-token`）。
 * 通过 ChannelService.getChannelFromToken 将 token 解析为商家 Channel。
 *
 * 注意：当前实现依赖 Channel token 作为共享密钥，未接入 Vendure 的完整
 * JWT/APIKey 鉴权体系。如需更严格的鉴权，可在此基础上接入
 * JwtStrategy / ApiKey 校验。
 */
export declare class MerchantApiController {
    private channelService;
    private settlementService;
    constructor(channelService: ChannelService, settlementService: SettlementService);
    private resolveChannel;
    private buildCtx;
    /** 对账单：GET /merchant-api/settlement?from=ISO&to=ISO */
    settlement(authHeader: string, from?: string, to?: string): Promise<{
        count: number;
        totalWithTax: number;
        entries: import("../settlement.service").MerchantSettlementEntry[];
    }>;
    /** 订单查询：GET /merchant-api/orders?from=ISO&to=ISO */
    orders(authHeader: string, from?: string, to?: string): Promise<{
        count: number;
        items: {
            orderId: import("@vendure/core").ID;
            orderCode: string;
            state: import("@vendure/core").OrderState;
            totalWithTax: number;
            currencyCode: import("@vendure/core").CurrencyCode;
            orderPlacedAt: Date | undefined;
        }[];
    }>;
}
