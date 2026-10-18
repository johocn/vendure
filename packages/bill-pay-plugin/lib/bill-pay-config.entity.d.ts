import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 渠道级代买单配置（设计文档 §4）。
 * 说明：设计原稿存 channel.customFields.billPayConfig，但自定义字段会对 channel 表加列，
 * 违反 §15 护栏「迁移只建新表、禁止 ALTER 既有表」，故按纯增量原则落独立表（JSON 文本列）。
 */
export declare class BillPayChannelConfigEntity extends VendureEntity {
    constructor(input?: DeepPartial<BillPayChannelConfigEntity>);
    channelId: number;
    /** BillPayChannelConfig JSON 序列化文本 */
    config: string;
}
