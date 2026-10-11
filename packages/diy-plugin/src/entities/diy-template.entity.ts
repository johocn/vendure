import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { DiyTemplateConfig, LocalizedText } from '../types';

/** DIY 玩法模板：config=slots+params+constraints+presentation；calculatorKey=null 兜底内置 sum */
@Entity()
@Index('idx_diy_template_app_code', ['app', 'code'])
export class DiyTemplate extends VendureEntity {
    constructor(input?: Partial<DiyTemplate>) {
        super(input);
    }

    @Column({ type: 'varchar', nullable: true })
    app: string | null;

    /** slug，如 bracelet-classic；唯一键 (app, code) 服务层校验 */
    @Column('varchar', { length: 64 })
    code: string;

    @Column('simple-json')
    name: LocalizedText;

    @Column('simple-json', { nullable: true })
    description: LocalizedText | null;

    @Column({ type: 'varchar', nullable: true })
    thumb: string | null;

    @Column('simple-json', { nullable: true })
    images: string[] | null;

    @Column('simple-json')
    config: DiyTemplateConfig;

    @Column('varchar', { nullable: true })
    calculatorKey: string | null;

    /** draft / enabled / disabled */
    @Column('varchar', { default: 'draft' })
    status: 'draft' | 'enabled' | 'disabled';

    /** 每次发布（publish → enabled）+1；仅用于「再编辑」提示，不参与复算 */
    @Column({ default: 1 })
    version: number;

    @Column({ default: 0 })
    sortOrder: number;
}
