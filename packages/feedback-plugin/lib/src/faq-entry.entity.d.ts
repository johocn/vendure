import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare class FaqEntry extends VendureEntity {
    constructor(input?: DeepPartial<FaqEntry>);
    title: string;
    content: string;
    /** 分组：general/order/pay/afterSale/account */
    type: string;
    sort: number;
    enabled: boolean;
    /** 多语言覆盖（LocalizedText JSON 存 text 列）；读取语义 titleI18n[lang] ?? title，zh-CN 与 title 同值 */
    titleI18n: string | null;
    contentI18n: string | null;
    /** 渠道隔离（仿 distribution WithdrawalRequest.channels，ListQueryBuilder channelId 过滤走此关系） */
    channels: Channel[];
}
