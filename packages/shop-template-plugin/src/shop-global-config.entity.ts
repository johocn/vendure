import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';
import { TemplateApp } from './types';

/** 全局配置（L1 底层）：每 app 一条 */
@Entity()
export class ShopGlobalConfig extends VendureEntity {
    constructor(input?: DeepPartial<ShopGlobalConfig>) {
        super(input);
    }

    @Column('varchar', { unique: true })
    app: TemplateApp;

    @Column('simple-json', { nullable: true })
    themeTokens?: Record<string, any>;

    @Column('simple-json', { nullable: true })
    defaults?: Record<string, any>;
}
