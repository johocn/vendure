import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 已处理的入站消息（MsgId 幂等去重）。
 * 微信回调 5 秒无应答会重试推送，本表防止同一条消息触发两次搜索/下单。
 * 事件类消息无 MsgId，用 from:createTime:event 组合键。
 */
@Entity({ name: 'wechat_processed_message' })
@Index(['dedupKey'], { unique: true })
export class WechatProcessedMessage extends VendureEntity {
    constructor(input?: DeepPartial<WechatProcessedMessage>) {
        super(input);
    }

    /** 去重键：msgId 或 from:createTime:event 组合 */
    @Column({ type: 'varchar', length: 128 })
    dedupKey: string;

    // type: Date 构造器让 typeorm 按方言推断（postgres→timestamp / sqlite→datetime，显式 'datetime' 不被 postgres 支持）
    @Column({ type: Date })
    receivedAt: Date;
}
