import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import {
    Channel,
    ChannelAware,
    DeepPartial,
    EntityId,
    HasCustomFields,
    ID,
    VendureEntity,
} from '@vendure/core';

class CustomShippingTemplateFields {}

/**
 * 配送方案模板
 *
 * 分为两类：
 * - 全局模板（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户模板（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从模板创建配送方式后，生成的 ShippingMethod 实例与模板完全解耦。
 */
@Entity()
export class ShippingTemplate extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<ShippingTemplate>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'text' }) description: string;

    @Column({ unique: false })
    code: string;

    @Column({ default: 'manual-fulfillment' })
    fulfillmentHandler: string;

    @Column({ type: 'simple-json' })
    checker: { code: string; arguments: Array<{ name: string; value: string }> };

    @Column({ type: 'simple-json' })
    calculator: { code: string; arguments: Array<{ name: string; value: string }> };

    @Column({ default: false })
    isGlobal: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomShippingTemplateFields)
    customFields: CustomShippingTemplateFields;
}
