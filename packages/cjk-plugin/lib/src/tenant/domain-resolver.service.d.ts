import { Channel, ChannelService, RequestContext } from '@vendure/core';
export interface DomainResolveResult {
    token: string;
    code: string;
}
export interface ChannelResolveResult {
    token: string;
    code: string;
    customFields: {
        shopName: string | null;
        shopLogo: string | null;
        shopIntro: string | null;
        servicePhone: string | null;
        shopContent: string | null;
        displayTemplate: string | null;
        themeId: string | null;
    };
}
/** 公开的「可用店铺」条目：供 C 端列出全部渠道（nshop / vshop 共用），
 *  是多租户路由运行时判定与店铺切换器的唯一数据源。 */
export interface ShopChannelEntry {
    code: string;
    token: string;
    name: string | null;
    tenantNo: number | null;
    isOfficial: boolean;
    isDefault: boolean;
}
/**
 * 按请求 Host 解析渠道（多租户路由/回调共用）。
 *
 * 使用 emptyCtx 跨 channel 查询，避免公共请求 ctx 的潜在 channel 过滤
 * （与 group-buy-plugin / distribution-plugin 的既定模式一致）。
 * 返回完整 Channel 实体，调用方可直接用于构造 RequestContext。
 */
export declare function findChannelByDomain(channelService: ChannelService, host: string): Promise<Channel | undefined>;
export declare function resolveChannelByDomain(channelService: ChannelService, host: string): Promise<DomainResolveResult | null>;
export declare class DomainResolverService {
    private channelService;
    constructor(channelService: ChannelService);
    resolveByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null>;
    /** Channel -> ChannelResolveResult 的统一映射（渠道 token 与装修 customFields） */
    private toResult;
    resolveByCode(ctx: RequestContext, code: string): Promise<ChannelResolveResult | null>;
    /** 列出全部「可用店铺」（公开信息：code / token / 店铺名 / 序号 / 官方 / 是否默认渠道）。
     *
     *  这是多租户「永久可达」的数据源：前端据此判定 URL 首段的真伪、渲染店铺切换器，
     *  无需把渠道清单烘焙进构建产物，新增/启用渠道后最长一个缓存周期（前端 SWR）即生效。
     *
     *  - 排除 customFields.enabled === false 的渠道（如临时验证渠道 t24）；
     *  - 包含默认渠道并标记 isDefault，供前端提供「返回平台店」入口；
     *  - 排序：默认渠道优先，其余按 code 升序（与历史 tenant-channels.json 口径一致）。 */
    listShopChannels(): Promise<ShopChannelEntry[]>;
}
