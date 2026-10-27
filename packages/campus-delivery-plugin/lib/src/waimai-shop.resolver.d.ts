import { RequestContext } from '@vendure/core';
import { SearchAssistService } from './search-assist.service';
import { WaimaiStoreService } from './waimai-store.service';
export declare class WaimaiShopResolver {
    private stores;
    private assist;
    constructor(stores: WaimaiStoreService, assist: SearchAssistService);
    /** 公开只读：C 端首页店铺列表（跨渠道元数据聚合） */
    waimaiStoreList(ctx: RequestContext): Promise<import("./waimai-store.service").WaimaiStore[]>;
    /**
     * 公开只读：语音/拍照搜索识别（P2-2）。
     * 按当前渠道配置选择服务商（mock / none），返回可直接用于站内搜索的关键词。
     */
    campusSearchAssist(ctx: RequestContext, type: string, payload?: string): Promise<import("./search-assist.service").CampusSearchAssistResultShape>;
}
