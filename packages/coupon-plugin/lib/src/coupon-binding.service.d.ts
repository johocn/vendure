import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
import { ProductCouponBinding } from './product-coupon-binding.entity';
import { CouponBindingCache } from './coupon-binding-cache';
import { CreateProductCouponBindingInput, UpdateProductCouponBindingInput } from './types';
/** 进程内共享的 binding 集合缓存实例（结算侧经 listByTemplate 走此缓存） */
export declare const couponBindingCache: CouponBindingCache;
/**
 * 商品绑券（运营层）：维护 ProductCouponBinding，并把「绑定到某商品」这一事实
 * 单向同步到 CouponTemplate（scope=SKU / variantId），使结算侧无需依赖 binding 也能
 * 按 SKU 范围判定。channelId 用于租户隔离（大整数列）。
 */
export declare class CouponBindingService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 单向同步模板 scope：绑定商品后模板必为 SKU 范围；
     * 单 variant 写 variantId，多 variant / 全规格置空（表示商品全 SKU）。
     */
    syncTemplateScope(ctx: RequestContext, tpl: CouponTemplate, binding: {
        variantIds?: number[] | null;
    }): Promise<void>;
    /** 商品下的可见绑定：enabled && 模板 enabled && claimable && 渠道匹配（详情页领券入口用） */
    listByProduct(ctx: RequestContext, productId: number): Promise<ProductCouponBinding[]>;
    /** 模板下的可见绑定（模板编辑页展示，过滤规则同上）——经进程内 TTL 缓存，CRUD 时主动失效 */
    listByTemplate(ctx: RequestContext, templateId: ID): Promise<ProductCouponBinding[]>;
    /** 后台管理用：商品下全部绑定（含停用、含非 claimable），按渠道隔离 */
    listByProductAdmin(ctx: RequestContext, productId: number): Promise<ProductCouponBinding[]>;
    /** 创建绑定：同渠道同商品同模板去重；save 后单向同步模板 scope=SKU */
    create(ctx: RequestContext, input: CreateProductCouponBindingInput): Promise<ProductCouponBinding>;
    /** 更新绑定：合并可更新字段；规格变化后重新同步模板 scope */
    update(ctx: RequestContext, input: UpdateProductCouponBindingInput): Promise<ProductCouponBinding>;
    /**
     * 末绑定回退：模板不再有任何 enabled binding 时，仅清空模板 variantId（释放单 SKU 指向），
     * 保持 template.scope 不变（不回退 ALL，不破坏历史）。判定时机：delete / toggleEnabled(off) / update(enabled=false)。
     */
    private syncTemplateScopeAfterMutation;
    /** 删除绑定 */
    delete(ctx: RequestContext, id: ID): Promise<void>;
    /** 启停翻转 */
    toggleEnabled(ctx: RequestContext, id: ID): Promise<ProductCouponBinding>;
    /** 可见性过滤：binding.enabled（查询已含，双保险）&& 模板 enabled && claimable && 渠道匹配 */
    private visibleBinding;
}
