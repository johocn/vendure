import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class FaqEntry extends VendureEntity {
    constructor(input?: DeepPartial<FaqEntry>) {
        super(input);
    }

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'text' })
    content: string;

    /** 分组：general/order/pay/afterSale/account */
    @Column({ type: 'varchar', default: 'general' })
    type: string;

    @Column({ type: 'int', default: 0 })
    sort: number;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    /** 多语言覆盖（LocalizedText JSON 存 text 列）；读取语义 titleI18n[lang] ?? title，zh-CN 与 title 同值 */
    @Column({ type: 'text', nullable: true })
    titleI18n: string | null;

    @Column({ type: 'text', nullable: true })
    contentI18n: string | null;

    /** 渠道隔离（仿 distribution WithdrawalRequest.channels，ListQueryBuilder channelId 过滤走此关系） */
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
