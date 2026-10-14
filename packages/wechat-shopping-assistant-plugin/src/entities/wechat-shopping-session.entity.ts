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

    /** 会话过期时间 */
    @Column({ type: 'datetime' })
    expireAt: Date;
}
