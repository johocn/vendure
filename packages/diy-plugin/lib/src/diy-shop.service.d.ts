import { RequestContext, TransactionalConnection } from '@vendure/core';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyMaterialFilter, DiyPlanSpec, DiyPluginOptions, DiyPlanBom } from './types';
export interface DiyMaterialList {
    items: DiyMaterial[];
    total: number;
}
export interface DiyPlanList {
    items: DiyPlan[];
    total: number;
}
/** 画廊条目（v2 公开橱窗）：title 派生自 bom 快照，authorName 实体暂无归属人昵称列 → null */
export interface DiyGalleryItem {
    id: string;
    title: string;
    coverMaterialIds: string[];
    totalAmount: number;
    totalCount: number;
    authorName: string | null;
    createdAt: Date;
}
export interface DiyGalleryList {
    items: DiyGalleryItem[];
    total: number;
}
export interface DiyPublicPlan {
    id: string;
    title: string;
    spec: DiyPlanSpec;
    totalAmount: number;
    totalCount: number;
    createdAt: Date;
    /** 分享缩略图（微信分享卡/广场展示用） */
    thumb: string | null;
    /** 服务端权威 BOM 快照（公开详情直接展示，避免客户端复算漂移） */
    bom: DiyPlanBom | null;
}
/**
 * C 端查询面（规格 §7 shop 部分）。
 * app 固定取插件 init 传入的租户端，不暴露给 C 端调用方。
 */
export declare class DiyShopService {
    private options;
    private connection;
    constructor(options: DiyPluginOptions, connection: TransactionalConnection);
    private get app();
    /** C 端素材列表：两层合并去重后内存过滤 + 分页（素材量级千内，内存过滤足够） */
    findShopMaterials(ctx: RequestContext, filter?: DiyMaterialFilter): Promise<DiyMaterialList>;
    /** C 端分类列表：平台 + 租户两层并集（无覆盖），仅 enabled，sortOrder 升序 */
    findShopCategories(ctx: RequestContext): Promise<DiyCategory[]>;
    private matchKeyword;
    /** categoryCode → 该码下两层分类 id 集合（分类并集、无覆盖） */
    private categoryIdsByCode;
    /** C 端模板列表：两层 enabled 模板，同 code 租户覆盖平台（模板无复制回链列） */
    findShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]>;
    /** C 端单模板：租户优先、其次平台，仅 enabled；不存在/未启用返回 null */
    findShopTemplateByCode(ctx: RequestContext, code: string): Promise<DiyTemplate | null>;
    /** C 端创建方案（可匿名演示）：required 槽位校验 → 合并素材 → 服务端复算 → draft 落库（价格快照） */
    createDiyPlan(ctx: RequestContext, input: {
        templateCode: string;
        spec: DiyPlanSpec;
        thumb?: string | null;
    }): Promise<DiyPlan>;
    /** 我的方案列表（未登录返回空页） */
    myDiyPlans(ctx: RequestContext, options?: {
        status?: 'draft' | 'quoted' | 'ordered';
        skip?: number;
        take?: number;
    }): Promise<DiyPlanList>;
    /** 我的方案详情（仅本人可见，他人/跨租户一律 null） */
    myDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan | null>;
    /** 报价（规格 §6.3）：draft/quoted 可重复报价（每次以服务端实时价复算覆盖 bom，新号新效期）；ordered 不可 */
    quoteDiyPlan(ctx: RequestContext, planId: string): Promise<DiyPlan>;
    private toGalleryItem;
    /** 公开画廊：仅 isPublic=true，按发布时间倒序，take 上限 50 */
    diyGalleryPlans(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
    }): Promise<DiyGalleryList>;
    /** 公开方案详情（分享页）：仅 isPublic=true，否则统一 PLAN_NOT_ACCESSIBLE（不暴露存在性） */
    diyPublicPlan(ctx: RequestContext, id: string): Promise<DiyPublicPlan>;
    /** 发布/取消发布（仅 owner）：发布记 publishedAt=now，取消置 null */
    publishDiyPlan(ctx: RequestContext, id: string, isPublic: boolean): Promise<DiyPlan>;
    /** 复制方案（owner 或 isPublic=true 可复制）：复制体归属当前用户、回到 draft、不公开，spec/bom 原样 */
    copyDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan>;
}
