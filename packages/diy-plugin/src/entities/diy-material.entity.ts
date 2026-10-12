import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { LocalizedText } from '../types';

/**
 * DIY 素材：单表两层（app=null 平台库 / 非空=租户库），层级唯一开关。
 * 金额分（整数）、长度 mm（double）。
 * 唯一键 (app, code) 在服务层校验（postgres 唯一索引对 NULL 视为互异，
 * 平台行无法用 DB 约束保唯一）；此处复合索引用于查询性能。
 */
@Entity()
@Index('idx_diy_material_app_code', ['app', 'code'])
export class DiyMaterial extends VendureEntity {
    constructor(input?: Partial<DiyMaterial>) {
        super(input);
    }

    @Column({ type: 'varchar', nullable: true })
    app: string | null;

    /** 货号：{大类码}-{材质码}-{直径两位}-{工艺码}，如 A-AGS-08-N */
    @Column('varchar', { length: 64 })
    code: string;

    @Column('simple-json')
    name: LocalizedText;

    @Column()
    categoryId: number;

    /** round / barrel / drum / faceted / spacer / cube / custom */
    @Column('varchar')
    shape: string;

    /** 径向直径 mm——渲染与筛选用 */
    @Column({ type: 'float', nullable: true })
    diameter: number | null;

    /** 轴向长度 mm——算量用它（隔片/桶珠远小于直径） */
    @Column({ type: 'float', nullable: true })
    axialLength: number | null;

    /** 孔径 mm——配线校验用 */
    @Column({ type: 'float', nullable: true })
    holeSize: number | null;

    /** 行业扩展属性（卡口型号/比例/色号/纹理种子…），计算器按约定 key 读取 */
    @Column('simple-json', { nullable: true })
    attrs: Record<string, any> | null;

    /** C 端演示渲染参数（bead-diy RenderSpec 同构） */
    @Column('simple-json', { nullable: true })
    render: Record<string, any> | null;

    /** 单价（分） */
    @Column('int')
    price: number;

    /** piece / gram / meter / cm；库存按此单位计整数 */
    @Column('varchar', { default: 'piece' })
    priceUnit: string;

    @Column('varchar', { length: 3, default: 'CNY' })
    currency: string;

    @Column('int', { default: 0 })
    stock: number;

    /** 图片 URL 数组（静态目录 + 动态 origin 由前端拼装） */
    @Column('simple-json', { nullable: true })
    images: string[] | null;

    /** 复制平台素材时的回链 */
    @Column({ type: 'int', nullable: true })
    sourceMaterialId: number | null;

    @Column({ default: true })
    enabled: boolean;

    @Column({ default: 0 })
    sortOrder: number;

    /** 透明底统一光照贴图（静态目录 URL，前端渲染用） */
    @Column({ type: 'varchar', nullable: true })
    renderUrl: string | null;

    /** 渲染预设枚举串：glass | jade | jade-flower | amber | pearl | metal | wood | matte */
    @Column({ type: 'varchar', nullable: true })
    renderPreset: string | null;
}
