"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const review_entity_1 = require("./review.entity");
const review_service_1 = require("./review.service");
/**
 * 店铺级评论流/统计（三期评价系统）单测：
 * channelReviews 渠道隔离 + approved 主评 + hasImages 过滤；
 * channelReviewStats 统计口径与空态结构。
 */
function makeService(opts = {}) {
    var _a, _b;
    const andWhere = vitest_1.vi.fn().mockReturnThis();
    const qb = {
        andWhere,
        getManyAndCount: vitest_1.vi.fn().mockResolvedValue((_a = opts.qbResult) !== null && _a !== void 0 ? _a : [[], 0]),
    };
    const listQueryBuilder = { build: vitest_1.vi.fn().mockReturnValue(qb) };
    const connection = {
        getRepository: vitest_1.vi.fn().mockReturnValue({ find: vitest_1.vi.fn().mockResolvedValue((_b = opts.findResult) !== null && _b !== void 0 ? _b : []) }),
    };
    const svc = new review_service_1.ReviewService({}, connection, listQueryBuilder, {}, {});
    return { svc, listQueryBuilder, qb, andWhere, connection };
}
function review(partial) {
    return new review_entity_1.Review(Object.assign({ rating: 5, status: 'approved', parentId: null, tags: null }, partial));
}
const CTX = { channelId: 113 };
(0, vitest_1.describe)('ReviewService.getChannelReviews', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('按渠道过滤 + approved 主评约束传入 listQueryBuilder', async () => {
        const { svc, listQueryBuilder } = makeService();
        await svc.getChannelReviews(CTX, { take: 10 });
        (0, vitest_1.expect)(listQueryBuilder.build).toHaveBeenCalledWith(review_entity_1.Review, { take: 10 }, vitest_1.expect.anything());
        const where = listQueryBuilder.build.mock.calls[0][2].where;
        (0, vitest_1.expect)(where.channelId).toBeUndefined();
        (0, vitest_1.expect)(where.status).toBe('approved');
        (0, vitest_1.expect)(where.parentId).toBeDefined();
        (0, vitest_1.expect)(where.rating).toBeUndefined();
    });
    (0, vitest_1.it)('hasImages=true 附加非空数组 SQL 过滤', async () => {
        const { svc, andWhere } = makeService();
        await svc.getChannelReviews(CTX, { hasImages: true });
        (0, vitest_1.expect)(andWhere).toHaveBeenCalledWith(`("images" IS NOT NULL AND "images" <> '[]')`);
    });
    (0, vitest_1.it)('hasImages 缺省/false 不附加过滤', async () => {
        const { svc, andWhere } = makeService();
        await svc.getChannelReviews(CTX, {});
        (0, vitest_1.expect)(andWhere).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('ratingMin/ratingMax 合并为单个 FindOperator 传入 where', async () => {
        const { svc, listQueryBuilder } = makeService();
        await svc.getChannelReviews(CTX, { ratingMin: 4 });
        const where = listQueryBuilder.build.mock.calls[0][2].where;
        (0, vitest_1.expect)(where.rating).toBeDefined();
        (0, vitest_1.expect)(where.rating.value).toBe(4);
    });
});
(0, vitest_1.describe)('ReviewService.getChannelReviewStats', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('按 channelId 查询并正确聚合（均分/好评率/分布/标签）', async () => {
        var _a, _b;
        const { svc, connection } = makeService({
            findResult: [
                review({ rating: 5, tags: ['口味赞', '分量足'] }),
                review({ rating: 4, tags: ['口味赞'] }),
                review({ rating: 2, tags: [] }),
            ],
        });
        const stats = await svc.getChannelReviewStats(CTX);
        const findArgs = connection.getRepository().find.mock.calls[0][0];
        (0, vitest_1.expect)(findArgs.where.channelId).toBe(113);
        (0, vitest_1.expect)(findArgs.where.status).toBe('approved');
        (0, vitest_1.expect)(findArgs.where.parentId).toBeDefined();
        (0, vitest_1.expect)(stats.totalCount).toBe(3);
        (0, vitest_1.expect)(stats.averageRating).toBe(3.7);
        (0, vitest_1.expect)(stats.goodRate).toBe(66.7);
        (0, vitest_1.expect)((_a = stats.ratingDistribution.find(d => d.rating === 5)) === null || _a === void 0 ? void 0 : _a.count).toBe(1);
        (0, vitest_1.expect)((_b = stats.ratingDistribution.find(d => d.rating === 2)) === null || _b === void 0 ? void 0 : _b.count).toBe(1);
        (0, vitest_1.expect)(stats.topTags[0]).toEqual({ tag: '口味赞', count: 2 });
    });
    (0, vitest_1.it)('无评价 → 零值结构（分布含全 5 档）', async () => {
        const { svc } = makeService({ findResult: [] });
        const stats = await svc.getChannelReviewStats(CTX);
        (0, vitest_1.expect)(stats.totalCount).toBe(0);
        (0, vitest_1.expect)(stats.averageRating).toBe(0);
        (0, vitest_1.expect)(stats.ratingDistribution).toHaveLength(5);
        (0, vitest_1.expect)(stats.topTags).toEqual([]);
    });
});
(0, vitest_1.describe)('ReviewService.getProductReviews hasImages', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('hasImages=true 同样生效且保留 productId 约束', async () => {
        const { svc, andWhere, listQueryBuilder } = makeService();
        await svc.getProductReviews(CTX, '42', { hasImages: true });
        (0, vitest_1.expect)(listQueryBuilder.build.mock.calls[0][2].where.productId).toBe(42);
        (0, vitest_1.expect)(andWhere).toHaveBeenCalledWith(`("images" IS NOT NULL AND "images" <> '[]')`);
    });
});
//# sourceMappingURL=review.service.spec.js.map