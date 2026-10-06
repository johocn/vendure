import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Review } from './review.entity';
import { ReviewService } from './review.service';

/**
 * 店铺级评论流/统计（三期评价系统）单测：
 * channelReviews 渠道隔离 + approved 主评 + hasImages 过滤；
 * channelReviewStats 统计口径与空态结构。
 */
function makeService(opts: { findResult?: Review[]; qbResult?: [Review[], number] } = {}) {
    const andWhere = vi.fn().mockReturnThis();
    const qb: any = {
        andWhere,
        getManyAndCount: vi.fn().mockResolvedValue(opts.qbResult ?? [[], 0]),
    };
    const listQueryBuilder = { build: vi.fn().mockReturnValue(qb) };
    const connection = {
        getRepository: vi.fn().mockReturnValue({ find: vi.fn().mockResolvedValue(opts.findResult ?? []) }),
    };
    const svc = new ReviewService({} as any, connection as any, listQueryBuilder as any, {} as any, {} as any);
    return { svc, listQueryBuilder, qb, andWhere, connection };
}

function review(partial: Partial<Review>): Review {
    return new Review({
        rating: 5,
        status: 'approved',
        parentId: null,
        tags: null,
        ...partial,
    } as any);
}

const CTX = { channelId: 113 } as any;

describe('ReviewService.getChannelReviews', () => {
    beforeEach(() => vi.clearAllMocks());

    it('按渠道过滤 + approved 主评约束传入 listQueryBuilder', async () => {
        const { svc, listQueryBuilder } = makeService();
        await svc.getChannelReviews(CTX, { take: 10 });
        expect(listQueryBuilder.build).toHaveBeenCalledWith(Review, { take: 10 }, expect.anything());
        const where = listQueryBuilder.build.mock.calls[0][2].where;
        expect(where.channelId).toBeUndefined();
        expect(where.status).toBe('approved');
        expect(where.parentId).toBeDefined();
        expect(where.rating).toBeUndefined();
    });

    it('hasImages=true 附加非空数组 SQL 过滤', async () => {
        const { svc, andWhere } = makeService();
        await svc.getChannelReviews(CTX, { hasImages: true });
        expect(andWhere).toHaveBeenCalledWith(`("images" IS NOT NULL AND "images" <> '[]')`);
    });

    it('hasImages 缺省/false 不附加过滤', async () => {
        const { svc, andWhere } = makeService();
        await svc.getChannelReviews(CTX, {});
        expect(andWhere).not.toHaveBeenCalled();
    });

    it('ratingMin/ratingMax 合并为单个 FindOperator 传入 where', async () => {
        const { svc, listQueryBuilder } = makeService();
        await svc.getChannelReviews(CTX, { ratingMin: 4 });
        const where = listQueryBuilder.build.mock.calls[0][2].where;
        expect(where.rating).toBeDefined();
        expect(where.rating.value).toBe(4);
    });
});

describe('ReviewService.getChannelReviewStats', () => {
    beforeEach(() => vi.clearAllMocks());

    it('按 channelId 查询并正确聚合（均分/好评率/分布/标签）', async () => {
        const { svc, connection } = makeService({
            findResult: [
                review({ rating: 5, tags: ['口味赞', '分量足'] }),
                review({ rating: 4, tags: ['口味赞'] }),
                review({ rating: 2, tags: [] }),
            ],
        });
        const stats = await svc.getChannelReviewStats(CTX);
        const findArgs = connection.getRepository().find.mock.calls[0][0];
        expect(findArgs.where.channelId).toBe(113);
        expect(findArgs.where.status).toBe('approved');
        expect(findArgs.where.parentId).toBeDefined();
        expect(stats.totalCount).toBe(3);
        expect(stats.averageRating).toBe(3.7);
        expect(stats.goodRate).toBe(66.7);
        expect(stats.ratingDistribution.find(d => d.rating === 5)?.count).toBe(1);
        expect(stats.ratingDistribution.find(d => d.rating === 2)?.count).toBe(1);
        expect(stats.topTags[0]).toEqual({ tag: '口味赞', count: 2 });
    });

    it('无评价 → 零值结构（分布含全 5 档）', async () => {
        const { svc } = makeService({ findResult: [] });
        const stats = await svc.getChannelReviewStats(CTX);
        expect(stats.totalCount).toBe(0);
        expect(stats.averageRating).toBe(0);
        expect(stats.ratingDistribution).toHaveLength(5);
        expect(stats.topTags).toEqual([]);
    });
});

describe('ReviewService.getProductReviews hasImages', () => {
    beforeEach(() => vi.clearAllMocks());

    it('hasImages=true 同样生效且保留 productId 约束', async () => {
        const { svc, andWhere, listQueryBuilder } = makeService();
        await svc.getProductReviews(CTX, '42', { hasImages: true });
        expect(listQueryBuilder.build.mock.calls[0][2].where.productId).toBe(42);
        expect(andWhere).toHaveBeenCalledWith(`("images" IS NOT NULL AND "images" <> '[]')`);
    });
});
