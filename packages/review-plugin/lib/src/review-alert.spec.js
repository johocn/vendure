"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const review_alert_1 = require("./review-alert");
const review_alert_service_1 = require("./review-alert.service");
const CTX = { channelId: 113, channel: { id: 113 } };
(0, vitest_1.describe)('review-alert 归因词典', () => {
    (0, vitest_1.it)('异物类关键词命中（头发/虫子）', () => {
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('菜里有一根头发')).toEqual(['异物']);
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('吃出虫子了')).toEqual(['异物']);
    });
    (0, vitest_1.it)('少送漏送 / 口味差 等多标签按词典顺序去重', () => {
        const tags = (0, review_alert_1.detectReviewAlertTags)('少送了一份米饭，而且太咸，包装还漏汤');
        (0, vitest_1.expect)(tags).toEqual(['少送漏送', '口味差', '包装差']);
    });
    (0, vitest_1.it)('最多 3 个标签', () => {
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('有头发、变质发酸、少送、太咸、凉了、配送慢').length).toBe(3);
    });
    (0, vitest_1.it)('空正文/无关键词返回空数组', () => {
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('')).toEqual([]);
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)(null)).toEqual([]);
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('很好吃，下次还来')).toEqual([]);
    });
    (0, vitest_1.it)('英文关键词同样命中', () => {
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('hair in the food')).toEqual(['异物']);
    });
    (0, vitest_1.it)('变凉类口语表述命中（凉了/凉的/凉透）', () => {
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('米饭也是凉的')).toEqual(['变凉']);
        (0, vitest_1.expect)((0, review_alert_1.detectReviewAlertTags)('汤都凉透了')).toEqual(['变凉']);
    });
});
(0, vitest_1.describe)('evaluateReviewAlert 预警判定', () => {
    (0, vitest_1.it)('星级触阈 → low_rating', () => {
        const d = (0, review_alert_1.evaluateReviewAlert)(1, '一般', 2);
        (0, vitest_1.expect)(d.alert).toBe(true);
        (0, vitest_1.expect)(d.reasons).toEqual(['low_rating']);
    });
    (0, vitest_1.it)('高星但正文含严重项 → severe_tag', () => {
        const d = (0, review_alert_1.evaluateReviewAlert)(5, '味道不错，但是有头发', 2);
        (0, vitest_1.expect)(d.alert).toBe(true);
        (0, vitest_1.expect)(d.reasons).toEqual(['severe_tag']);
        (0, vitest_1.expect)(d.tags).toEqual(['异物']);
    });
    (0, vitest_1.it)('未触阈且无严重项 → 不预警', () => {
        const d = (0, review_alert_1.evaluateReviewAlert)(4, '稍咸但还行', 2);
        (0, vitest_1.expect)(d.alert).toBe(false);
        (0, vitest_1.expect)(d.reasons).toEqual([]);
    });
    (0, vitest_1.it)('阈值可调（4 星阈值时 4 星即预警）', () => {
        (0, vitest_1.expect)((0, review_alert_1.evaluateReviewAlert)(4, '一般', 4).alert).toBe(true);
    });
});
(0, vitest_1.describe)('normalizeMaxRating', () => {
    (0, vitest_1.it)('越界回落 2，合法值取整', () => {
        (0, vitest_1.expect)((0, review_alert_1.normalizeMaxRating)(0)).toBe(2);
        (0, vitest_1.expect)((0, review_alert_1.normalizeMaxRating)(6)).toBe(2);
        (0, vitest_1.expect)((0, review_alert_1.normalizeMaxRating)('3')).toBe(3);
        (0, vitest_1.expect)((0, review_alert_1.normalizeMaxRating)(undefined)).toBe(2);
        (0, vitest_1.expect)((0, review_alert_1.normalizeMaxRating)(3.7)).toBe(3);
    });
});
function makeService() {
    const repo = {
        findOne: vitest_1.vi.fn().mockResolvedValue(null),
        save: vitest_1.vi.fn(async (x) => { var _a; return (Object.assign(Object.assign({}, x), { id: (_a = x.id) !== null && _a !== void 0 ? _a : 1 })); }),
        findAndCount: vitest_1.vi.fn().mockResolvedValue([[], 0]),
        count: vitest_1.vi.fn().mockResolvedValue(0),
        createQueryBuilder: vitest_1.vi.fn().mockReturnValue({ where: vitest_1.vi.fn().mockReturnThis(), andWhere: vitest_1.vi.fn().mockReturnThis(), getCount: vitest_1.vi.fn().mockResolvedValue(0) }),
    };
    const connection = { getRepository: vitest_1.vi.fn(() => repo), getEntityOrThrow: vitest_1.vi.fn() };
    const productService = { findOne: vitest_1.vi.fn().mockResolvedValue({ name: '宫保鸡丁' }) };
    const svc = new review_alert_service_1.ReviewAlertService(connection, productService);
    return { svc, repo, connection, productService };
}
function review(partial = {}) {
    return Object.assign({ id: 900, productId: 12, customerId: 5, rating: 1, content: '菜里有头发' }, partial);
}
(0, vitest_1.describe)('ReviewAlertService 规则', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('未配置规则返回默认（启用/2 星/不发券）', async () => {
        const { svc } = makeService();
        (0, vitest_1.expect)(await svc.getRule(CTX)).toEqual({
            channelId: 113,
            enabled: true,
            maxRating: 2,
            couponTemplateId: null,
        });
    });
    (0, vitest_1.it)('updateRule 创建并保存（阈值非法回落 2，空券模板转 null）', async () => {
        const { svc, repo } = makeService();
        const saved = await svc.updateRule(CTX, { maxRating: 9, couponTemplateId: '  ' });
        (0, vitest_1.expect)(repo.save).toHaveBeenCalled();
        (0, vitest_1.expect)(saved.maxRating).toBe(2);
        (0, vitest_1.expect)(saved.couponTemplateId).toBeNull();
    });
});
(0, vitest_1.describe)('ReviewAlertService.recordFromReview', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('命中低星 → 建预警（含标签）', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        const alert = await svc.recordFromReview(CTX, review());
        (0, vitest_1.expect)(alert).not.toBeNull();
        (0, vitest_1.expect)(alert.status).toBe('new');
        (0, vitest_1.expect)(alert.tags).toEqual(['异物']);
        (0, vitest_1.expect)(alert.couponStatus).toBe('none');
        (0, vitest_1.expect)(repo.save).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('同一评价已存在预警 → 幂等返回旧记录', async () => {
        const { svc, repo } = makeService();
        const existing = { id: 3, reviewId: 900 };
        repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
        (0, vitest_1.expect)(await svc.recordFromReview(CTX, review())).toBe(existing);
        (0, vitest_1.expect)(repo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('未命中（4 星无严重词）→ 返回 null 不落库', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce(null);
        (0, vitest_1.expect)(await svc.recordFromReview(CTX, review({ rating: 4, content: '一般般' }))).toBeNull();
        (0, vitest_1.expect)(repo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('规则关闭时不预警', async () => {
        const { svc, repo } = makeService();
        repo.findOne.mockResolvedValueOnce({ channelId: 113, enabled: false, maxRating: 2, couponTemplateId: null });
        (0, vitest_1.expect)(await svc.recordFromReview(CTX, review())).toBeNull();
    });
});
(0, vitest_1.describe)('ReviewAlertService 处置动作', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('replyAlert 空回复拒绝', async () => {
        const { svc } = makeService();
        await (0, vitest_1.expect)(svc.replyAlert(CTX, 1, '  ')).rejects.toThrow();
    });
    (0, vitest_1.it)('replyAlert 写回评价回复并把预警置为已回评', async () => {
        const { svc, repo, connection } = makeService();
        const alert = { id: 2, reviewId: 900, status: 'new', note: null };
        connection.getEntityOrThrow.mockResolvedValueOnce(alert).mockResolvedValueOnce({ id: 900 });
        const saved = await svc.replyAlert(CTX, 2, '抱歉，已为您全额退款');
        (0, vitest_1.expect)(saved.status).toBe('replied');
        (0, vitest_1.expect)(saved.handledAt).toBeInstanceOf(Date);
    });
    (0, vitest_1.it)('resendCoupon 未配券模板 → 报错', async () => {
        const { svc, repo, connection } = makeService();
        repo.findOne.mockResolvedValueOnce(null); // 规则为空 → 默认无券模板
        connection.getEntityOrThrow.mockResolvedValueOnce({ id: 2, customerId: 5 });
        await (0, vitest_1.expect)(svc.resendCoupon(CTX, 2)).rejects.toThrow();
    });
    (0, vitest_1.it)('closeAlert 置为已关闭并留备注', async () => {
        const { svc, connection } = makeService();
        connection.getEntityOrThrow.mockResolvedValueOnce({ id: 2, status: 'new', note: null });
        const saved = await svc.closeAlert(CTX, 2, '线下已补偿');
        (0, vitest_1.expect)(saved.status).toBe('closed');
        (0, vitest_1.expect)(saved.note).toBe('线下已补偿');
    });
    (0, vitest_1.it)('getStats 汇总新预警/总量/已补偿/近 7 日', async () => {
        const { svc, repo } = makeService();
        repo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
        const stats = await svc.getStats(CTX);
        (0, vitest_1.expect)(stats).toEqual({ newCount: 2, totalCount: 5, compensatedCount: 1, last7dCount: 0 });
    });
});
//# sourceMappingURL=review-alert.spec.js.map