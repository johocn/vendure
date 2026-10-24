import { RequestContext, TransactionalConnection } from '@vendure/core';
/**
 * 合并默认配送档案结果。
 */
export interface CampusEnsureProfileResult {
    profileId: string;
    profileName: string;
    /** 已挂到档案并绑定到渠道的配送方式 code */
    linkedMethodCodes: string[];
    /** 按预期 code 未找到的配送方式（渠道缺该方式时 R2/R4 对应路线不可用） */
    missingMethodCodes: string[];
    /** 本次补绑定的「未绑档案」变体数 */
    boundVariantCount: number;
}
/**
 * 合并默认配送档案（R2/R4 档案冲突治本，三期）。
 *
 * 背景：cjk 分箱按变体 customFields.shippingProfileId 出配送方式，变体档案为单值，
 * R2 需含 courier-delivery 的档案、R4 需含 store-pickup 的档案，两者互顶。
 * 本服务 get-or-create 渠道租户默认档案并合并两种方式 → 把渠道内未绑档案的变体
 * 补绑到该默认档案（不触碰已显式绑定的变体），幂等可重复点击。
 *
 * 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；
 * ShippingProfile 由 cjk-plugin 注册于同一进程，同 waimai-store.service 模式）。
 */
export declare class ShippingProfileEnsureService {
    private connection;
    constructor(connection: TransactionalConnection);
    ensureDefaultShippingProfile(ctx: RequestContext, channelId: number): Promise<CampusEnsureProfileResult>;
    /** 渠道内未绑配送档案的变体补绑到 profileId（列名同 cjk assignToVariants 原生 SQL 口径）。 */
    private bindUnboundVariants;
}
