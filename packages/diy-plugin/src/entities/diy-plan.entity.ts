import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { DiyPlanBom, DiyPlanSpec } from '../types';

/**
 * DIY 搭配方案（规格 §6.1）：draft / quoted / ordered 三态统一载体。
 * spec 与 bom 均为快照——模板/素材后续改版不影响存量方案；
 * quote/order 环节会以服务端实时价复算并覆盖 bom（quoteRefAmount 记录报价参考价）。
 */
@Entity()
@Index('idx_diy_plan_app_user', ['app', 'userId'])
export class DiyPlan extends VendureEntity {
    constructor(input?: Partial<DiyPlan>) {
        super(input);
    }

    /** 租户端（nshop/vshop）；方案恒归属某租户端，非空 */
    @Column()
    app: string;

    /** null = 未登录演示方案（不能报价/下单） */
    @Column({ type: 'int', nullable: true })
    userId: number | null;

    @Column()
    templateId: number;

    /** 创建时模板 version（再编辑提示用，不参与复算） */
    @Column({ default: 1 })
    templateVersion: number;

    /** draft / quoted / ordered */
    @Column('varchar', { default: 'draft' })
    status: 'draft' | 'quoted' | 'ordered';

    @Column('simple-json')
    spec: DiyPlanSpec;

    @Column('simple-json')
    bom: DiyPlanBom;

    /** 生成当前 bom 时使用的 @diy/calc 语义化版本 */
    @Column('varchar', { length: 16 })
    calcVersion: string;

    /** 报价单号 DIY-YYYYMMDD-XXXXXX，quoteDiyPlan 时写入 */
    @Column('varchar', { length: 32, nullable: true })
    quoteNo: string | null;

    // type: Date（构造器）让 typeorm 按方言推断（postgres→timestamp / sqlite→datetime）；
    // 不能写裸 @Column()——`Date | null` 联合类型 design:type 反射为 Object，两边都不认；
    // 显式 'timestamp' 不被 sqljs 支持、'datetime' 不被 postgres 支持（typeorm 驱动源码实证）
    @Column({ type: Date, nullable: true })
    expiresAt: Date | null;

    /** 成单后的 Vendure OrderLine id */
    @Column({ type: 'int', nullable: true })
    orderLineId: number | null;

    /** 方案封面（C 端渲染截图，createDiyPlan 传入） */
    @Column({ type: 'varchar', nullable: true })
    thumb: string | null;

    /** 分享图（P5 使用，可空） */
    @Column({ type: 'varchar', nullable: true })
    shareImage: string | null;
}
