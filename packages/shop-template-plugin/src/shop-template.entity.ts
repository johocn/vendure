import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { TemplateApp } from './types';

/**
 * 风格模板：全局模板库（不按 channel 隔离），店铺通过 channel.customFields.templateId 引用。
 * JSON 用 simple-json 列（sqlite/postgres 双兼容）。
 */
@Entity()
export class ShopTemplate extends VendureEntity {
    constructor(input?: DeepPartial<ShopTemplate>) {
        super(input);
    }

    @Column('varchar')
    name: string;

    /** 目标端 nshop | vshop（创建后不可改，service 层校验） */
    @Column('varchar')
    app: TemplateApp;

    /** L2 模板级 token（primaryColor/accentColor/radius 等） */
    @Column('simple-json', { nullable: true })
    theme?: Record<string, any>;

    /** L3 页面/模块配置（按页 key：product/home/category/cart/profile） */
    @Column('simple-json', { nullable: true })
    pages?: Record<string, any>;

    /** 版本号（复制模板时 +1） */
    @Column({ default: 1 })
    version: number;

    /** 停用后 C 端回退 L0/L1 */
    @Column({ default: true })
    enabled: boolean;
}
