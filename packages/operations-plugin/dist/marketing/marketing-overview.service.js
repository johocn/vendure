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
    async countCouponByStatus(ctx, now) {
        try {
            const repo = this.connection.getRepository(ctx, 'Coupon');
            const active = await repo
                .createQueryBuilder('e')
                .where('e.isActive = :isActive', { isActive: true })
                .andWhere('e.startAt <= :now', { now })
                .andWhere('e.endAt >= :now', { now })
                .getCount();
            const upcoming = await repo
                .createQueryBuilder('e')
                .where('e.startAt > :now', { now })
                .getCount();
            const ended = await repo
                .createQueryBuilder('e')
                .where('e.endAt < :now', { now })
                .getCount();
            return { active, upcoming, ended };
        }
        catch (_a) {
            return { active: 0, upcoming: 0, ended: 0 };
        }
    }
};
exports.MarketingOverviewService = MarketingOverviewService;
exports.MarketingOverviewService = MarketingOverviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MarketingOverviewService);
