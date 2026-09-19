import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { CouponTemplate } from './coupon-template.entity';
import { ProductCouponBinding } from './product-coupon-binding.entity';
import { CouponBindingCache } from './coupon-binding-cache';
import { CreateProductCouponBindingInput, UpdateProductCouponBindingInput } from './types';

/** 进程内共享的 binding 集合缓存实例（结算侧经 listByTemplate 走此缓存） */
export const couponBindingCache = new CouponBindingCache();

/**
 * 商品绑券（运营层）：维护 ProductCouponBinding，并把「绑定到某商品」这一事实
 * 单向同步到 CouponTemplate（scope=SKU / variantId），使结算侧无需依赖 binding 也能
 * 按 SKU 范围判定。channelId 用于租户隔离（大整数列）。
 */
@Injectable()
export class CouponBindingService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * 单向同步模板 scope：绑定商品后模板必为 SKU 范围；
     * 单 variant 写 variantId，多 variant / 全规格置空（表示商品全 SKU）。
     */
    async syncTemplateScope(
        ctx: RequestContext,
        tpl: CouponTemplate,
        binding: { variantIds?: number[] | null },
    ): Promise<void> {
        tpl.scope = 'SKU' as any;
        tpl.variantId = binding.variantIds?.length === 1 ? binding.variantIds[0] : (null as any);
        await this.connection.getRepository(ctx, CouponTemplate).save(tpl);
        couponBindingCache.invalidate(tpl.id as any);
    }

    /** 商品下的可见绑定：enabled && 模板 enabled && claimable && 渠道匹配（详情页领券入口用） */
    async listByProduct(ctx: RequestContext, productId: number): Promise<ProductCouponBinding[]> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const bindings = await repo.find({
            where: { productId, enabled: true },
            relations: { template: true },
            order: { displayOrder: 'ASC' },
        });
        return bindings.filter(b => this.visibleBinding(b, ctx));
    }

    /** 模板下的可见绑定（模板编辑页展示，过滤规则同上）——经进程内 TTL 缓存，CRUD 时主动失效 */
    async listByTemplate(ctx: RequestContext, templateId: ID): Promise<ProductCouponBinding[]> {
        const key = `${ctx.channel?.id ?? 0}:${templateId}`;
        return couponBindingCache.get(key, async () => {
            const repo = this.connection.getRepository(ctx, ProductCouponBinding);
            const bindings = await repo.find({
                where: { couponTemplateId: templateId as any, enabled: true },
                relations: { template: true },
            });
            return bindings.filter(b => this.visibleBinding(b, ctx));
        }) as Promise<ProductCouponBinding[]>;
    }

    /** 后台管理用：商品下全部绑定（含停用、含非 claimable），按渠道隔离 */
    async listByProductAdmin(ctx: RequestContext, productId: number): Promise<ProductCouponBinding[]> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const bindings = await repo.find({
            where: { productId },
            relations: { template: true },
            order: { displayOrder: 'ASC' },
        });
        return bindings.filter(b => !b.channelId || Number(b.channelId) === Number(ctx.channel?.id));
    }

    /** 创建绑定：同渠道同商品同模板去重；save 后单向同步模板 scope=SKU */
    async create(
        ctx: RequestContext,
        input: CreateProductCouponBindingInput,
    ): Promise<ProductCouponBinding> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        // 去重：同商品同模板（同渠道）不可重复绑定
        const existing = await repo.findOne({
            where: { productId: input.productId, couponTemplateId: input.couponTemplateId },
        });
        if (existing) {
            throw new UserInputError('Binding already exists');
        }
        const binding = new ProductCouponBinding(input);
        // 未显式指定渠道时，归属当前租户渠道（bigint 列以 number 落库）
        if (binding.channelId == null && ctx.channel?.id != null) {
            binding.channelId = Number(ctx.channel.id);
        }
        const saved = await repo.save(binding);
        // 单向同步模板 scope=SKU（模板不存在时跳过，不阻断绑券）
        const tplRepo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: input.couponTemplateId as any } });
        if (tpl) {
            await this.syncTemplateScope(ctx, tpl, saved);
        }
        couponBindingCache.invalidate(input.couponTemplateId as any);
        return saved;
    }

    /** 更新绑定：合并可更新字段；规格变化后重新同步模板 scope */
    async update(
        ctx: RequestContext,
        input: UpdateProductCouponBindingInput,
    ): Promise<ProductCouponBinding> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: input.id } });
        if (!binding) {
            throw new UserInputError(`ProductCouponBinding with id ${input.id} not found`);
        }
        const updatable: Array<keyof UpdateProductCouponBindingInput> = [
            'variantIds',
            'enabled',
            'displayOrder',
            'badgeText',
            'promoTitle',
            'remark',
            'perUserClaimLimit',
            'claimWindowStart',
            'claimWindowEnd',
            'claimStock',
        ];
        for (const key of updatable) {
            if (key in input) {
                (binding as any)[key] = input[key];
            }
        }
        const saved = await repo.save(binding);
        const tplRepo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: saved.couponTemplateId as any } });
        if (tpl) {
            await this.syncTemplateScope(ctx, tpl, saved);
        }
        // explicit enabled=false → 可能触达末绑定回退（syncTemplateScope 之上再兜底一次）
        if (input.enabled === false && saved.couponTemplateId != null) {
            await this.syncTemplateScopeAfterMutation(ctx, saved.couponTemplateId);
        }
        couponBindingCache.invalidate(saved.couponTemplateId as any);
        return saved;
    }

    /**
     * 末绑定回退：模板不再有任何 enabled binding 时，仅清空模板 variantId（释放单 SKU 指向），
     * 保持 template.scope 不变（不回退 ALL，不破坏历史）。判定时机：delete / toggleEnabled(off) / update(enabled=false)。
     */
    private async syncTemplateScopeAfterMutation(
        ctx: RequestContext,
        templateId: number | null,
    ): Promise<void> {
        if (templateId == null) {
            return;
        }
        const bindingRepo = this.connection.getRepository(ctx, ProductCouponBinding);
        const remaining = await bindingRepo.count({
            where: { couponTemplateId: templateId as any, enabled: true },
        });
        if (remaining > 0) {
            // 还有启用绑定，模板 scope 不变
            return;
        }
        const tplRepo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: templateId as any } });
        if (tpl && tpl.variantId != null) {
            tpl.variantId = null as any;
            await tplRepo.save(tpl);
        }
    }

    /** 删除绑定 */
    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: id as any } });
        await repo.delete(id);
        if (binding?.couponTemplateId != null) {
            await this.syncTemplateScopeAfterMutation(ctx, binding.couponTemplateId);
            couponBindingCache.invalidate(binding.couponTemplateId as any);
        }
    }

    /** 启停翻转 */
    async toggleEnabled(ctx: RequestContext, id: ID): Promise<ProductCouponBinding> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: id as any } });
        if (!binding) {
            throw new UserInputError(`ProductCouponBinding with id ${id} not found`);
        }
        binding.enabled = !binding.enabled;
        const saved = await repo.save(binding);
        if (!saved.enabled && saved.couponTemplateId != null) {
            await this.syncTemplateScopeAfterMutation(ctx, saved.couponTemplateId);
        }
        couponBindingCache.invalidate(saved.couponTemplateId as any);
        return saved;
    }

    /** 可见性过滤：binding.enabled（查询已含，双保险）&& 模板 enabled && claimable && 渠道匹配 */
    private visibleBinding(b: ProductCouponBinding, ctx: RequestContext): boolean {
        // channelId 为 number 大整数列，ctx.channel.id 为 string，需统一转 number 比较
        const channelMatch = !b.channelId || Number(b.channelId) === Number(ctx.channel?.id);
        return !!b.enabled && !!b.template?.enabled && !!b.template.claimable && channelMatch;
    }
}
