export interface MarketplacePluginOptions {
    /** 平台自营 Channel 的 code（默认 default） */
    platformChannelCode?: string;
    /** 「平台运营」角色 code */
    platformOpsRoleCode?: string;
}
export interface CreateSellerInput {
    firstName: string;
    lastName: string;
    emailAddress: string;
    password: string;
}
