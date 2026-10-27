import { ID, RequestContext } from '@vendure/core';
import { CampusAdService } from './campus-ad.service';
/**
 * P2-3 广告位与商家自助投放计费。
 * - 商家（CampusMerchant）：看广告位报价、下单、模拟支付、取消
 * - 平台（CampusConfig）：按渠道查投放单、审核通过/驳回
 * - C 端公开：按广告位取当前在投广告
 */
export declare class CampusAdResolver {
    private ads;
    constructor(ads: CampusAdService);
    campusAdSlots(): Promise<{
        code: string;
        name: string;
        unitPriceFen: number;
    }[]>;
    campusMerchantAds(ctx: RequestContext): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    campusMerchantCreateAd(ctx: RequestContext, slot: string, title: string, startDate: string, endDate: string, imageUrl?: string | null, linkUrl?: string | null): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusMerchantPayAd(ctx: RequestContext, id: ID): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusMerchantCancelAd(ctx: RequestContext, id: ID): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusAdCampaigns(ctx: RequestContext, status?: string | null, channelId?: string | null): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    campusReviewAd(ctx: RequestContext, id: ID, approve: boolean, note?: string | null): Promise<{
        status: string;
        live: boolean;
        channelId: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        startDate: string;
        endDate: string;
        days: number;
        unitPriceFen: number;
        totalFen: number;
        payRef: string | null;
        paidAt: Date | null;
        reviewNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdBy: string | null;
        id: ID;
        createdAt: Date;
        updatedAt: Date;
    }>;
    campusActiveAds(ctx: RequestContext, slot: string): Promise<{
        id: ID;
        slot: string;
        title: string;
        imageUrl: string | null;
        linkUrl: string | null;
        endDate: string;
    }[]>;
}
