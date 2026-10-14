import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { CardProduct } from '../types';

/**
 * 微信购物助手会话：openid 维度保存最近一次搜索结果（编号 → 商品）。
 * 用户回复「买N」时按编号回查本表下单；过期需重新搜索。
 */
@Entity({ name: 'wechat_shopping_session' })
@Index(['openid'], { unique: true })
export class WechatShoppingSession extends VendureEntity {
    constructor(input?: DeepPartial<WechatShoppingSession>) {
        super(input);
    }

    /** 用户 openid（公众号） */
    @Column({ type: 'varchar', length: 64 })
    openid: string;

    /** 下单目标渠道 id（字符串，与 meili 文档 channelId 一致） */
    @Column({ type: 'varchar', length: 64 })
    channelId: string;

    /** 最近一次搜索结果（含会话序号），simple-json 存储 */
    @Column({ type: 'simple-json' })
    results: CardProduct[];

    /** 原始查询词（会话过期引导重搜时展示） */
    @Column({ type: 'varchar', length: 255, nullable: true })
    query: string | null;

    /**
     * 对话状态机：null=正常会话；awaiting_phone/awaiting_address=建档补录；
     * addr_ 与 order_confirm 前缀状态=地址管理 + 下单选地址（方案 B 列表式逐轮问答）
     */
    @Column({ type: 'varchar', length: 32, nullable: true })
    state: string | null;

    /** 状态机草稿（手机号/待下单编号/地址流程上下文），simple-json */
    @Column({ type: 'simple-json', nullable: true })
    draft: { phone?: string | null; indices?: number[] } | null;

    /** 会话过期时间；type: Date 构造器让 typeorm 按方言推断（postgres→timestamp / sqlite→datetime，显式 'datetime' 不被 postgres 支持） */
    @Column({ type: Date })
    expireAt: Date;
}
