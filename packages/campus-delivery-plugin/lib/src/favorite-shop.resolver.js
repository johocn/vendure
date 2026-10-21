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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 商家收藏（C 端常用功能）。
 * 店铺 = 渠道，收藏记录落独立表 campus_favorite_shop（customerId + channelId 唯一），
 * 因此不受当前 activeChannel 影响：在店铺渠道内点收藏、回默认渠道读列表都能用。
 * 接口均为登录态；未登录返回 NOT_LOGGED_IN，前端游客态走本地存储。
 */
let FavoriteShopResolver = class FavoriteShopResolver {
    constructor(customerService, dataSource) {
        this.customerService = customerService;
        this.dataSource = dataSource;
    }
    async campusFavoriteStores(ctx) {
        const customerId = await this.requireCustomerId(ctx);
        const rows = await this.dataSource.query(`SELECT "channelId" FROM campus_favorite_shop WHERE "customerId" = $1 ORDER BY "createdAt" ASC`, [customerId]);
        return rows.map(r => String(r.channelId));
    }
    async campusToggleFavoriteStore(ctx, channelId) {
        const customerId = await this.requireCustomerId(ctx);
        const channelPk = Number(channelId);
        if (!Number.isInteger(channelPk) || channelPk <= 0) {
            throw new core_1.UserInputError('CHANNEL_NOT_FOUND');
        }
        const channel = await this.dataSource.getRepository(core_1.Channel).findOne({ where: { id: channelPk } });
        if (!channel) {
            throw new core_1.UserInputError('CHANNEL_NOT_FOUND');
        }
        // 已收藏 → 删（取消）；未收藏 → 增。唯一约束兜底并发重复插入。
        const removed = await this.dataSource.query(`DELETE FROM campus_favorite_shop WHERE "customerId" = $1 AND "channelId" = $2 RETURNING id`, [customerId, channel.id]);
        if (!removed.length) {
            await this.dataSource.query(`INSERT INTO campus_favorite_shop ("customerId", "channelId") VALUES ($1, $2)
                 ON CONFLICT ("customerId", "channelId") DO NOTHING`, [customerId, channel.id]);
        }
        return this.campusFavoriteStores(ctx);
    }
    /** Customer 无 userId 标量，按 user 关系反查（不过滤渠道，避免店铺渠道内收藏失败） */
    async requireCustomerId(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('NOT_LOGGED_IN');
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UserInputError('CUSTOMER_NOT_FOUND');
        }
        return customer.id;
    }
};
exports.FavoriteShopResolver = FavoriteShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "campusFavoriteStores", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], FavoriteShopResolver.prototype, "campusToggleFavoriteStore", null);
exports.FavoriteShopResolver = FavoriteShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.CustomerService, typeorm_1.DataSource])
], FavoriteShopResolver);
//# sourceMappingURL=favorite-shop.resolver.js.map