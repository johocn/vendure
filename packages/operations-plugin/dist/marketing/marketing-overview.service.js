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
exports.MarketingOverviewService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const constants_1 = require("../constants");
let MarketingOverviewService = class MarketingOverviewService {
    constructor(connection) {
        this.connection = connection;
    }
    assertPermission(ctx) {
        if (!ctx.userHasPermissions([constants_1.OperationsPermissions.ManagePromotion])) {
            throw new core_1.ForbiddenError();
        }
    }
    async getOverview(ctx) {
        this.assertPermission(ctx);
        const now = new Date();
        const flashSale = await this.countByStatus(ctx, 'FlashSaleActivity', now);
        const groupBuy = await this.countByStatus(ctx, 'GroupBuyActivity', now);
        const coupon = await this.countCouponByStatus(ctx, now);
        return { flashSale, groupBuy, coupon };
    }
    async countByStatus(ctx, entityName, now) {
        try {
            const repo = this.connection.getRepository(ctx, entityName);
            const active = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'active' })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
            const upcoming = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'upcoming' })
                .orWhere('e.startAt > :now', { now })
                .getCount();
            const ended = await repo
                .createQueryBuilder('e')
                .where('e.status = :status', { status: 'ended' })
                .orWhere('e.endAt < :now', { now })
                .getCount();
            return { active, upcoming, ended };
        }
        catch (_a) {
            return { active: 0, upcoming: 0, ended: 0 };
        }
    }
    /**
     * 券数量按状态统计。
     *
     * 注（2026-09-30）：coupon-plugin 在 2026-09-19 重构后**已不存在 `Coupon` 实体**
     * （改为 `CouponTemplate` + `CustomerCoupon`），旧实现 `getRepository(ctx, 'Coupon')`
     * 的报错被外层 try/catch 吞掉，导致券数量恒为 0/0/0。这里改用 `CouponTemplate`
     * （字段 `enabled` / `startsAt` / `endsAt`，两者均可为空 = 长期有效）。
     */
    async countCouponByStatus(ctx, now) {
        const repo = this.connection.getRepository(ctx, coupon_plugin_1.CouponTemplate);
        const active = await repo
            .createQueryBuilder('e')
            .where('e.enabled = :enabled', { enabled: true })
            .andWhere('(e.startsAt IS NULL OR e.startsAt <= :now)', { now })
            .andWhere('(e.endsAt IS NULL OR e.endsAt >= :now)', { now })
            .getCount();
        const upcoming = await repo
            .createQueryBuilder('e')
            .where('e.startsAt > :now', { now })
            .getCount();
        const ended = await repo
            .createQueryBuilder('e')
            .where('e.endsAt < :now', { now })
            .getCount();
        return { active, upcoming, ended };
    }
};
exports.MarketingOverviewService = MarketingOverviewService;
exports.MarketingOverviewService = MarketingOverviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MarketingOverviewService);
