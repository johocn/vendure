import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectReviewAlertTags, evaluateReviewAlert, normalizeMaxRating } from './review-alert';
import { ReviewAlertService } from './review-alert.service';

const CTX = { channelId: 113, channel: { id: 113 } } as any;

describe('review-alert 归因词典', () => {
    it('异物类关键词命中（头发/虫子）', () => {
        expect(detectReviewAlertTags('菜里有一根头发')).toEqual(['异物']);
        expect(detectReviewAlertTags('吃出虫子了')).toEqual(['异物']);
    });

    it('少送漏送 / 口味差 等多标签按词典顺序去重', () => {
        const tags = detectReviewAlertTags('少送了一份米饭，而且太咸，包装还漏汤');
        expect(tags).toEqual(['少送漏送', '口味差', '包装差']);
    });

    it('最多 3 个标签', () => {
        expect(detectReviewAlertTags('有头发、变质发酸、少送、太咸、凉了、配送慢').length).toBe(3);
    });

    it('空正文/无关键词返回空数组', () => {
        expect(detectReviewAlertTags('')).toEqual([]);
        expect(detectReviewAlertTags(null)).toEqual([]);
        expect(detectReviewAlertTags('很好吃，下次还来')).toEqual([]);
    });

    it('英文关键词同样命中', () => {
        expect(detectReviewAlertTags('hair in the food')).toEqual(['异物']);
    });
});

describe('evaluateReviewAlert 预警判定', () => {
    it('星级触阈 → low_rating', () => {
        const d = evaluateReviewAlert(1, '一般', 2);
        expect(d.alert).toBe(true);
        expect(d.reasons).toEqual(['low_rating']);
    });

    it('高星但正文含严重项 → severe_tag', () => {
        const d = evaluateReviewAlert(5, '味道不错，但是有头发', 2);
        expect(d.alert).toBe(true);
        expect(d.reasons).toEqual(['severe_tag']);
        expect(d.tags).toEqual(['异物']);
    });

    it('未触阈且无严重项 → 不预警', () => {
        const d = evaluateReviewAlert(4, '稍咸但还行', 2);
        expect(d.alert).toBe(false);
        expect(d.reasons).toEqual([]);
    });

    it('阈值可调（4 星阈值时 4 星即预警）', () => {
        expect(evaluateReviewAlert(4, '一般', 4).alert).toBe(true);
    });
});

describe('normalizeMaxRating', () => {
    it('越界回落 2，合法值取整', () => {
        expect(normalizeMaxRating(0)).toBe(2);
        expect(normalizeMaxRating(6)).toBe(2);
        expect(normalizeMaxRating('3')).toBe(3);
        expect(normalizeMaxRating(undefined)).toBe(2);
        expect(normalizeMaxRating(3.7)).toBe(3);
    });
});

function makeService() {
    const repo: any = {
        findOne: vi.fn().mockResolvedValue(null),
        save: vi.fn(async (x: any) => ({ ...x, id: x.id ?? 1 })),
        findAndCount: vi.fn().mockResolvedValue([[], 0]),
        count: vi.fn().mockResolvedValue(0),
        createQueryBuilder: vi.fn().mockReturnValue({ where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getCount: vi.fn().mockResolvedValue(0) }),
    };
    const connection: any = { getRepository: vi.fn(() => repo), getEntityOrThrow: vi.fn() };
    const productService: any = { findOne: vi.fn().mockResolvedValue({ name: '宫保鸡丁' }) };
    const svc = new ReviewAlertService(connection, productService);
    return { svc, repo, connection, productService };
}

function review(partial: any = {}) {
    return { id: 900, productId: 12, customerId: 5, rating: 1, content: '菜里有头发', ...partial } as any;
}

describe('ReviewAlertService 规则', () => {
    beforeEach(() => vi.clearAllMocks());

    it('未配置规则返回默认（启用/2 星/不发券）', async () => {
        const { svc } = makeService();
        expect(await svc.getRule(CTX)).toEqual({
            channelId: 113,
            enabled: true,
            maxRating: 2,
            couponTemplateId: null,
        });
    });

    it('updateRule 创建并保存（阈值非法回落 2，空券模板转 null）', async () => {
        const { svc, repo } = makeService();
        const saved = await svc.updateRule(CTX, { maxRating: 9, couponTemplateId: '  ' });
        expect(repo.save).toHaveBeenCalled();
        expect(saved.maxRating).toBe(2);
        expect(saved.couponTemplateId).toBeNull();
    });
});

describe('ReviewAlertService.recordFromReview', () => {
    beforeEach(() => vi.clearAllMocks());

    it('命中低星 → 建预警（含标签）', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        const alert: any = await svc.recordFromReview(CTX, review());
        expect(alert).not.toBeNull();
        expect(alert.status).toBe('new');
        expect(alert.tags).toEqual(['异物']);
        expect(alert.couponStatus).toBe('none');
        expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('同一评价已存在预警 → 幂等返回旧记录', async () => {
        const { svc, repo } = makeService();
        const existing = { id: 3, reviewId: 900 };
        repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
        expect(await svc.recordFromReview(CTX, review())).toBe(existing);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('未命中（4 星无严重词）→ 返回 null 不落库', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce(null);
        expect(await svc.recordFromReview(CTX, review({ rating: 4, content: '一般般' }))).toBeNull();
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('规则关闭时不预警', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce({ channelId: 113, enabled: false, maxRating: 2, couponTemplateId: null });
        expect(await svc.recordFromReview(CTX, review())).toBeNull();
    });
});

describe('ReviewAlertService 处置动作', () => {
    beforeEach(() => vi.clearAllMocks());

    it('replyAlert 空回复拒绝', async () => {
        const { svc } = makeService();
        await expect(svc.replyAlert(CTX, 1 as any, '  ')).rejects.toThrow();
    });

    it('replyAlert 写回评价回复并把预警置为已回评', async () => {
        const { svc, repo, connection } = makeService();
        const alert = { id: 2, reviewId: 900, status: 'new', note: null } as any;
        connection.getEntityOrThrow.mockResolvedValueOnce(alert).mockResolvedValueOnce({ id: 900 } as any);
        const saved: any = await svc.replyAlert(CTX, 2 as any, '抱歉，已为您全额退款');
        expect(saved.status).toBe('replied');
        expect(saved.handledAt).toBeInstanceOf(Date);
    });

    it('resendCoupon 未配券模板 → 报错', async () => {
        const { svc, repo, connection } = makeService();
        repo.findOne.mockResolvedValueOnce(null); // 规则为空 → 默认无券模板
        connection.getEntityOrThrow.mockResolvedValueOnce({ id: 2, customerId: 5 } as any);
        await expect(svc.resendCoupon(CTX, 2 as any)).rejects.toThrow();
    });

    it('closeAlert 置为已关闭并留备注', async () => {
        const { svc, connection } = makeService();
        connection.getEntityOrThrow.mockResolvedValueOnce({ id: 2, status: 'new', note: null } as any);
        const saved: any = await svc.closeAlert(CTX, 2 as any, '线下已补偿');
        expect(saved.status).toBe('closed');
        expect(saved.note).toBe('线下已补偿');
    });

    it('getStats 汇总新预警/总量/已补偿/近 7 日', async () => {
        const { svc, repo } = makeService();
        repo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
        const stats = await svc.getStats(CTX);
        expect(stats).toEqual({ newCount: 2, totalCount: 5, compensatedCount: 1, last7dCount: 0 });
    });
});
