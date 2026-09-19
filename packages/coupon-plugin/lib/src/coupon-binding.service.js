"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponBindingService = exports.couponBindingCache = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_template_entity_1 = require("./coupon-template.entity");
const product_coupon_binding_entity_1 = require("./product-coupon-binding.entity");
const coupon_binding_cache_1 = require("./coupon-binding-cache");
/** 进程内共享的 binding 集合缓存实例（结算侧经 listByTemplate 走此缓存） */
exports.couponBindingCache = new coupon_binding_cache_1.CouponBindingCache();
/**
 * 商品绑券（运营层）：维护 ProductCouponBinding，并把「绑定到某商品」这一事实
 * 单向同步到 CouponTemplate（scope=SKU / variantId），使结算侧无需依赖 binding 也能
 * 按 SKU 范围判定。channelId 用于租户隔离（大整数列）。
 */
let CouponBindingService = class CouponBindingService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * 单向同步模板 scope：绑定商品后模板必为 SKU 范围；
     * 单 variant 写 variantId，多 variant / 全规格置空（表示商品全 SKU）。
     */
    async syncTemplateScope(ctx, tpl, binding) {
        var _a;
        tpl.scope = 'SKU';
        tpl.variantId = ((_a = binding.variantIds) === null || _a === void 0 ? void 0 : _a.length) === 1 ? binding.variantIds[0] : null;
        await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).save(tpl);
        exports.couponBindingCache.invalidate(tpl.id);
    }
    /** 商品下的可见绑定：enabled && 模板 enabled && claimable && 渠道匹配（详情页领券入口用） */
    async listByProduct(ctx, productId) {
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const bindings = await repo.find({
            where: { productId, enabled: true },
            relations: { template: true },
            order: { displayOrder: 'ASC' },
        });
        return bindings.filter(b => this.visibleBinding(b, ctx));
    }
    /** 模板下的可见绑定（模板编辑页展示，过滤规则同上）——经进程内 TTL 缓存，CRUD 时主动失效 */
    async listByTemplate(ctx, templateId) {
        var _a, _b;
        const key = `${(_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 0}:${templateId}`;
        return exports.couponBindingCache.get(key, async () => {
            const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
            const bindings = await repo.find({
                where: { couponTemplateId: templateId, enabled: true },
                relations: { template: true },
            });
            return bindings.filter(b => this.visibleBinding(b, ctx));
        });
    }
    /** 后台管理用：商品下全部绑定（含停用、含非 claimable），按渠道隔离 */
    async listByProductAdmin(ctx, productId) {
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const bindings = await repo.find({
            where: { productId },
            relations: { template: true },
            order: { displayOrder: 'ASC' },
        });
        return bindings.filter(b => { var _a; return !b.channelId || Number(b.channelId) === Number((_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.id); });
    }
    /** 创建绑定：同渠道同商品同模板去重；save 后单向同步模板 scope=SKU */
    async create(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        // 去重：同商品同模板（同渠道）不可重复绑定
        const existing = await repo.findOne({
            where: { productId: input.productId, couponTemplateId: input.couponTemplateId },
        });
        if (existing) {
            throw new core_1.UserInputError('Binding already exists');
        }
        const binding = new product_coupon_binding_entity_1.ProductCouponBinding(input);
        // 未显式指定渠道时，归属当前租户渠道（bigint 列以 number 落库）
        if (binding.channelId == null && ((_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.id) != null) {
            binding.channelId = Number(ctx.channel.id);
        }
        const saved = await repo.save(binding);
        // 单向同步模板 scope=SKU（模板不存在时跳过，不阻断绑券）
        const tplRepo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: input.couponTemplateId } });
        if (tpl) {
            await this.syncTemplateScope(ctx, tpl, saved);
        }
        exports.couponBindingCache.invalidate(input.couponTemplateId);
        return saved;
    }
    /** 更新绑定：合并可更新字段；规格变化后重新同步模板 scope */
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: input.id } });
        if (!binding) {
            throw new core_1.UserInputError(`ProductCouponBinding with id ${input.id} not found`);
        }
        const updatable = [
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
                binding[key] = input[key];
            }
        }
        const saved = await repo.save(binding);
        const tplRepo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: saved.couponTemplateId } });
        if (tpl) {
            await this.syncTemplateScope(ctx, tpl, saved);
        }
        // explicit enabled=false → 可能触达末绑定回退（syncTemplateScope 之上再兜底一次）
        if (input.enabled === false && saved.couponTemplateId != null) {
            await this.syncTemplateScopeAfterMutation(ctx, saved.couponTemplateId);
        }
        exports.couponBindingCache.invalidate(saved.couponTemplateId);
        return saved;
    }
    /**
     * 末绑定回退：模板不再有任何 enabled binding 时，仅清空模板 variantId（释放单 SKU 指向），
     * 保持 template.scope 不变（不回退 ALL，不破坏历史）。判定时机：delete / toggleEnabled(off) / update(enabled=false)。
     */
    async syncTemplateScopeAfterMutation(ctx, templateId) {
        if (templateId == null) {
            return;
        }
        const bindingRepo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const remaining = await bindingRepo.count({
            where: { couponTemplateId: templateId, enabled: true },
        });
        if (remaining > 0) {
            // 还有启用绑定，模板 scope 不变
            return;
        }
        const tplRepo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await tplRepo.findOne({ where: { id: templateId } });
        if (tpl && tpl.variantId != null) {
            tpl.variantId = null;
            await tplRepo.save(tpl);
        }
    }
    /** 删除绑定 */
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: id } });
        await repo.delete(id);
        if ((binding === null || binding === void 0 ? void 0 : binding.couponTemplateId) != null) {
            await this.syncTemplateScopeAfterMutation(ctx, binding.couponTemplateId);
            exports.couponBindingCache.invalidate(binding.couponTemplateId);
        }
    }
    /** 启停翻转 */
    async toggleEnabled(ctx, id) {
        const repo = this.connection.getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding);
        const binding = await repo.findOne({ where: { id: id } });
        if (!binding) {
            throw new core_1.UserInputError(`ProductCouponBinding with id ${id} not found`);
        }
        binding.enabled = !binding.enabled;
        const saved = await repo.save(binding);
        if (!saved.enabled && saved.couponTemplateId != null) {
            await this.syncTemplateScopeAfterMutation(ctx, saved.couponTemplateId);
        }
        exports.couponBindingCache.invalidate(saved.couponTemplateId);
        return saved;
    }
    /** 可见性过滤：binding.enabled（查询已含，双保险）&& 模板 enabled && claimable && 渠道匹配 */
    visibleBinding(b, ctx) {
        var _a, _b;
        // channelId 为 number 大整数列，ctx.channel.id 为 string，需统一转 number 比较
        const channelMatch = !b.channelId || Number(b.channelId) === Number((_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.id);
        return !!b.enabled && !!((_b = b.template) === null || _b === void 0 ? void 0 : _b.enabled) && !!b.template.claimable && channelMatch;
    }
};
exports.CouponBindingService = CouponBindingService;
exports.CouponBindingService = CouponBindingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], CouponBindingService);
//# sourceMappingURL=coupon-binding.service.js.map