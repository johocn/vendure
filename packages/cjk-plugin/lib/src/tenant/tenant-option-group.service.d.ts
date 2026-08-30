import { ChannelService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class TenantOptionGroupService {
    private connection;
    private channelService;
    constructor(connection: TransactionalConnection, channelService: ChannelService);
    /** 取某组当前语言的名称（从 translations 抽 zh_Hans，回退首个）。 */
    private groupName;
    private optionName;
    /** 返回「本租户渠道私有组 + 默认渠道平台组」并集（跨渠道只读，不改归属）。 */
    reusableOptionGroups(ctx: RequestContext): Promise<Array<{
        id: ID;
        name: string;
        options: Array<{
            id: ID;
            name: string;
        }>;
    }>>;
    /** 把已有规格组直接绑定到商品（跨渠道直连 Product.optionGroups，幂等）。 */
    reuseOptionGroupForProduct(productId: ID, optionGroupId: ID): Promise<boolean>;
}
