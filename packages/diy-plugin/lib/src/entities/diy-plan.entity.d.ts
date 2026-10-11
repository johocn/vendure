import { VendureEntity } from '@vendure/core';
import { DiyPlanBom, DiyPlanSpec } from '../types';
/**
 * DIY 搭配方案（规格 §6.1）：draft / quoted / ordered 三态统一载体。
 * spec 与 bom 均为快照——模板/素材后续改版不影响存量方案；
 * quote/order 环节会以服务端实时价复算并覆盖 bom（quoteRefAmount 记录报价参考价）。
 */
export declare class DiyPlan extends VendureEntity {
    constructor(input?: Partial<DiyPlan>);
    /** 租户端（nshop/vshop）；方案恒归属某租户端，非空 */
    app: string;
    /** null = 未登录演示方案（不能报价/下单） */
    userId: number | null;
    templateId: number;
    /** 创建时模板 version（再编辑提示用，不参与复算） */
    templateVersion: number;
    /** draft / quoted / ordered */
    status: 'draft' | 'quoted' | 'ordered';
    spec: DiyPlanSpec;
    bom: DiyPlanBom;
    /** 生成当前 bom 时使用的 @diy/calc 语义化版本 */
    calcVersion: string;
    /** 报价单号 DIY-YYYYMMDD-XXXXXX，quoteDiyPlan 时写入 */
    quoteNo: string | null;
    expiresAt: Date | null;
    /** 成单后的 Vendure OrderLine id */
    orderLineId: number | null;
    /** 方案封面（C 端渲染截图，createDiyPlan 传入） */
    thumb: string | null;
    /** 分享图（P5 使用，可空） */
    shareImage: string | null;
}
