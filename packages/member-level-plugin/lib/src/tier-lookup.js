"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberTierLookup = exports.MemberTierLookup = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const member_tier_entity_1 = require("./member-tier.entity");
// 免运费 checker / 专属折扣 condition+action 都是 configurable-operation（非 Nest provider），
// 无法直接注入 MemberLevelService。这里用一个模块级持有 connection 的轻量 lookup，
// 经 init(injector) 注入，统一封装「按 customer 解析档位」的查询逻辑（与 service 表驱动同口径）。
// 避免与 MemberLevelService 互相依赖形成假循环，也避免重复手写查询散落各处。
let MemberTierLookup = class MemberTierLookup {
    init(injector) {
        this.connection = injector.get(core_1.TransactionalConnection);
    }
    repo(ctx) {
        if (!this.connection) {
            throw new Error('MemberTierLookup not initialized');
        }
        return this.connection.getRepository(ctx, member_tier_entity_1.MemberTier);
    }
    /** 按顾客解析当前档位（读 customFields.growthValue → 表驱动 threshold<=growth 最大档）。 */
    async tierForCustomer(ctx, customerId) {
        var _a, _b;
        const customerRepo = this.connection.getRepository(ctx, core_1.Customer);
        const customer = await customerRepo.findOne({
            where: { id: customerId },
        });
        const growth = (_b = (_a = customer === null || customer === void 0 ? void 0 : customer.customFields) === null || _a === void 0 ? void 0 : _a.growthValue) !== null && _b !== void 0 ? _b : 0;
        return this.tierForGrowth(ctx, growth);
    }
    /** 按成长值解析档位：查表取 threshold<=growth 的最大档；无记录返回最低档（threshold 0）。 */
    async tierForGrowth(ctx, growthValue) {
        const all = await this.repo(ctx).find({
            where: { channelId: ctx.channelId },
            order: { tierLevel: 'ASC' },
        });
        if (all.length === 0) {
            return {
                tierLevel: 1,
                threshold: 0,
                name: '普通会员',
                pointsMultiplier: 1000,
                redeemDiscountRate: 1000,
                redeemCapRatio: 500,
                specialDiscountRate: 0,
            };
        }
        let hit = all[0];
        for (const t of all) {
            if (growthValue >= t.threshold) {
                hit = t;
            }
        }
        return hit;
    }
};
exports.MemberTierLookup = MemberTierLookup;
exports.MemberTierLookup = MemberTierLookup = __decorate([
    (0, common_1.Injectable)()
], MemberTierLookup);
// 模块级单例，供 configurable-operation 的 init() 注入持有。
exports.memberTierLookup = new MemberTierLookup();
//# sourceMappingURL=tier-lookup.js.map