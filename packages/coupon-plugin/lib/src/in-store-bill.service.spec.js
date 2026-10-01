"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
const in_store_bill_service_1 = require("./in-store-bill.service");
const in_store_bill_1 = require("./in-store-bill");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/** 构造一张可用到店买单券模板 */
function tplStub(over = {}) {
    return Object.assign({ id: 7, type: 'PERCENT', discountValue: 80, minSpend: 0, enabled: true, shopId: null, name: '到店 8 折', channels: [{ id: 3 }] }, over);
}
function ccStub(over = {}) {
    return Object.assign({ id: 11, code: 'C-ABCD-EFGH', customerId: 5, templateId: 7, status: 'UNUSED', expiredAt: null, template: tplStub() }, over);
}
(0, vitest_1.describe)('InStoreBillService.quote', () => {
    const ctx = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };
    let ccRepo;
    let billRepo;
    let customerRepo;
    let adminRepo;
    let connection;
    let couponService;
    let service;
    (0, vitest_1.beforeEach)(() => {
        ccRepo = { findOne: vitest_1.vi.fn(), createQueryBuilder: vitest_1.vi.fn() };
        billRepo = { save: vitest_1.vi.fn(async (b) => (Object.assign({ id: 1 }, b))), createQueryBuilder: vitest_1.vi.fn() };
        customerRepo = { findOne: vitest_1.vi.fn(async () => ({ firstName: '三', lastName: '张', phoneNumber: '13800000000', emailAddress: 'a@b.c' })) };
        adminRepo = { findOne: vitest_1.vi.fn(async () => ({ firstName: '掌', lastName: '柜', emailAddress: 'op@shop.c' })) };
        connection = {
            getRepository: vitest_1.vi.fn((_c, entity) => {
                if (entity === customer_coupon_entity_1.CustomerCoupon)
                    return ccRepo;
                if (entity === in_store_bill_entity_1.InStoreBill)
                    return billRepo;
                if (entity === core_1.Customer)
                    return customerRepo;
                if (entity === core_1.Administrator)
                    return adminRepo;
                throw new Error(`unknown entity: ${entity === null || entity === void 0 ? void 0 : entity.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vitest_1.vi.fn(() => true),
            assertManagedByShop: vitest_1.vi.fn(async () => undefined),
        };
        service = new in_store_bill_service_1.InStoreBillService(connection, couponService);
    });
    (0, vitest_1.it)('券码为空 → COUPON_NOT_FOUND，不查库', async () => {
        const r = await service.quote(ctx, '   ', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_FOUND });
        (0, vitest_1.expect)(ccRepo.findOne).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('券不存在 → COUPON_NOT_FOUND', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        const r = await service.quote(ctx, 'C-NOPE-0001', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_FOUND });
    });
    (0, vitest_1.it)('模板停用 → TEMPLATE_DISABLED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ enabled: false }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.TEMPLATE_DISABLED });
    });
    (0, vitest_1.it)('券已使用 → COUPON_NOT_UNUSED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ status: 'USED' }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_UNUSED });
    });
    (0, vitest_1.it)('券已过期 → COUPON_EXPIRED', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ expiredAt: new Date(Date.now() - 1000) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_EXPIRED });
    });
    (0, vitest_1.it)('场景为 ONLINE → SCENE_MISMATCH', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'ONLINE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.SCENE_MISMATCH });
    });
    (0, vitest_1.it)('场景为 ALL 放行', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'ALL' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: true, finalAmount: 8000 });
    });
    (0, vitest_1.it)('跨渠道 → TENANT_MISMATCH（渠道判断返回 false）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        couponService.templateBelongsToChannel.mockReturnValueOnce(false);
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.TENANT_MISMATCH });
    });
    (0, vitest_1.it)('非本店券（assertManagedByShop 抛错）→ TENANT_MISMATCH', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE', shopId: 88 }) }));
        couponService.assertManagedByShop.mockRejectedValueOnce(new Error('COUPON_NOT_OWNED'));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.TENANT_MISMATCH });
    });
    (0, vitest_1.it)('originalAmount 省略 → 只回券信息，金额字段为 null', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH');
        (0, vitest_1.expect)(r).toMatchObject({
            ok: true,
            couponCode: 'C-ABCD-EFGH',
            couponName: '到店 8 折',
            discountType: 'PERCENT',
            discountValue: 80,
            finalAmount: null,
        });
        (0, vitest_1.expect)(r.customerName).toBe('三 张');
        (0, vitest_1.expect)(r.customerPhone).toBe('13800000000');
    });
    (0, vitest_1.it)('试算成功：8 折券原价 20000 → 优惠 4000 / 实付 16000（并回券信息）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 20000);
        (0, vitest_1.expect)(r).toMatchObject({
            ok: true, originalAmount: 20000, discountAmount: 4000, finalAmount: 16000, couponName: '到店 8 折',
        });
    });
    (0, vitest_1.it)('未达门槛 → ok=false + MIN_SPEND_NOT_MET，但仍带回券信息（供页面展示券卡）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE', minSpend: 10000 }) }));
        const r = await service.quote(ctx, 'C-ABCD-EFGH', 5000);
        (0, vitest_1.expect)(r).toMatchObject({ ok: false, reason: in_store_bill_1.IN_STORE_REASON.MIN_SPEND_NOT_MET, couponName: '到店 8 折' });
        (0, vitest_1.expect)(r.finalAmount).toBeNull();
    });
    (0, vitest_1.it)('查询券时按 code 且带 template.channels 关系', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        await service.quote(ctx, 'C-ABCD-EFGH', 10000);
        (0, vitest_1.expect)(ccRepo.findOne).toHaveBeenCalledWith({
            where: { code: 'C-ABCD-EFGH' },
            relations: { template: { channels: true } },
        });
    });
});
(0, vitest_1.describe)('InStoreBillService.redeem', () => {
    const ctx = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };
    let ccRepo;
    let billRepo;
    let updateQb;
    let connection;
    let couponService;
    let service;
    (0, vitest_1.beforeEach)(() => {
        updateQb = {
            update: vitest_1.vi.fn().mockReturnThis(),
            set: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            execute: vitest_1.vi.fn(async () => ({ affected: 1 })),
        };
        ccRepo = { findOne: vitest_1.vi.fn(), createQueryBuilder: vitest_1.vi.fn(() => updateQb) };
        billRepo = { save: vitest_1.vi.fn(async (b) => (Object.assign({ id: 21 }, b))) };
        connection = {
            getRepository: vitest_1.vi.fn((_c, entity) => {
                if (entity === customer_coupon_entity_1.CustomerCoupon)
                    return ccRepo;
                if (entity === in_store_bill_entity_1.InStoreBill)
                    return billRepo;
                if (entity === core_1.Customer)
                    return { findOne: vitest_1.vi.fn(async () => ({ firstName: '三', lastName: '张', phoneNumber: '13800000000' })) };
                if (entity === core_1.Administrator)
                    return { findOne: vitest_1.vi.fn(async () => ({ firstName: '掌', lastName: '柜' })) };
                throw new Error(`unknown entity: ${entity === null || entity === void 0 ? void 0 : entity.name}`);
            }),
        };
        couponService = {
            templateBelongsToChannel: vitest_1.vi.fn(() => true),
            assertManagedByShop: vitest_1.vi.fn(async () => undefined),
        };
        service = new in_store_bill_service_1.InStoreBillService(connection, couponService);
    });
    (0, vitest_1.it)('成功核销：条件更新置 USED → 写流水（含券/顾客/核销人/金额快照）', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        const bill = await service.redeem(ctx, ' C-ABCD-EFGH ', 20000, '老客户');
        (0, vitest_1.expect)(updateQb.set).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'USED' }));
        (0, vitest_1.expect)(updateQb.where).toHaveBeenCalledWith('id = :id AND status = :unused', {
            id: 11,
            unused: 'UNUSED',
        });
        (0, vitest_1.expect)(bill).toMatchObject({
            id: 21,
            channelId: 3,
            customerCouponId: 11,
            couponCode: 'C-ABCD-EFGH',
            couponTemplateId: 7,
            couponName: '到店 8 折',
            customerId: 5,
            customerName: '三 张',
            customerPhone: '13800000000',
            discountType: 'PERCENT',
            discountValue: 80,
            originalAmount: 20000,
            discountAmount: 4000,
            finalAmount: 16000,
            operatorId: 99,
            operatorName: '掌 柜',
            remark: '老客户',
        });
        (0, vitest_1.expect)(bill.billedAt).toBeInstanceOf(Date);
    });
    (0, vitest_1.it)('券不存在 → 抛 UserInputError（优惠券不存在），不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(null);
        await (0, vitest_1.expect)(service.redeem(ctx, 'C-NOPE-0001', 20000)).rejects.toThrow('优惠券不存在');
        (0, vitest_1.expect)(billRepo.save).not.toHaveBeenCalled();
        (0, vitest_1.expect)(updateQb.execute).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('未达门槛 → 抛 UserInputError，不置 USED、不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE', minSpend: 10000 }) }));
        await (0, vitest_1.expect)(service.redeem(ctx, 'C-ABCD-EFGH', 5000)).rejects.toThrow('未达到该券使用门槛');
        (0, vitest_1.expect)(updateQb.execute).not.toHaveBeenCalled();
        (0, vitest_1.expect)(billRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('并发/重复核销（affectedRows=0）→ 抛 COUPON_NOT_UNUSED 文案，不写流水', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        updateQb.execute.mockResolvedValueOnce({ affected: 0 });
        await (0, vitest_1.expect)(service.redeem(ctx, 'C-ABCD-EFGH', 20000)).rejects.toThrow('该优惠券已使用或当前不可用');
        (0, vitest_1.expect)(billRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('FREE_SHIPPING 券 → 抛类型不支持文案', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE', type: 'FREE_SHIPPING' }) }));
        await (0, vitest_1.expect)(service.redeem(ctx, 'C-ABCD-EFGH', 20000)).rejects.toThrow('该券类型不支持到店买单');
    });
    (0, vitest_1.it)('非法原价（0）→ 抛金额文案', async () => {
        ccRepo.findOne.mockResolvedValueOnce(ccStub({ template: tplStub({ usageScene: 'IN_STORE' }) }));
        await (0, vitest_1.expect)(service.redeem(ctx, 'C-ABCD-EFGH', 0)).rejects.toThrow('请输入有效的消费金额');
    });
});
(0, vitest_1.describe)('InStoreBillService.list / summary', () => {
    const ctx = { channelId: 3, activeUserId: 99, languageCode: 'zh_Hans' };
    let listQb;
    let connection;
    let service;
    (0, vitest_1.beforeEach)(() => {
        listQb = {
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            addOrderBy: vitest_1.vi.fn().mockReturnThis(),
            skip: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            select: vitest_1.vi.fn().mockReturnThis(),
            addSelect: vitest_1.vi.fn().mockReturnThis(),
            getManyAndCount: vitest_1.vi.fn(async () => [[{ id: 1 }], 1]),
            getRawOne: vitest_1.vi.fn(async () => ({ count: '3', originalTotal: '30000', discountTotal: '6000', finalTotal: '24000' })),
        };
        connection = {
            getRepository: vitest_1.vi.fn(() => ({ createQueryBuilder: vitest_1.vi.fn(() => listQb) })),
        };
        service = new in_store_bill_service_1.InStoreBillService(connection, {});
    });
    (0, vitest_1.it)('list：强制按 ctx.channelId 过滤，默认时间倒序 + 分页上限 200', async () => {
        await service.list(ctx, { skip: 0, take: 500 });
        (0, vitest_1.expect)(listQb.where).toHaveBeenCalledWith('b.channelId = :channelId', { channelId: 3 });
        (0, vitest_1.expect)(listQb.orderBy).toHaveBeenCalledWith('b.billedAt', 'DESC');
        (0, vitest_1.expect)(listQb.addOrderBy).toHaveBeenCalledWith('b.id', 'DESC');
        (0, vitest_1.expect)(listQb.take).toHaveBeenCalledWith(200);
    });
    (0, vitest_1.it)('list：券码 / 时间区间筛选生效', async () => {
        const from = new Date('2026-10-01T00:00:00.000Z');
        const to = new Date('2026-10-31T23:59:59.999Z');
        await service.list(ctx, { couponCode: 'C-ABCD-EFGH', from, to });
        (0, vitest_1.expect)(listQb.andWhere).toHaveBeenCalledWith('b.couponCode = :code', { code: 'C-ABCD-EFGH' });
        (0, vitest_1.expect)(listQb.andWhere).toHaveBeenCalledWith('b.billedAt >= :from', { from });
        (0, vitest_1.expect)(listQb.andWhere).toHaveBeenCalledWith('b.billedAt <= :to', { to });
    });
    (0, vitest_1.it)('summary：字符串聚合值转数字，并按渠道 isolate', async () => {
        const s = await service.summary(ctx, {});
        (0, vitest_1.expect)(listQb.where).toHaveBeenCalledWith('b.channelId = :channelId', { channelId: 3 });
        (0, vitest_1.expect)(s).toEqual({ count: 3, originalTotal: 30000, discountTotal: 6000, finalTotal: 24000 });
    });
    (0, vitest_1.it)('summary：空结果回退 0', async () => {
        listQb.getRawOne.mockResolvedValueOnce({ count: null, originalTotal: null, discountTotal: null, finalTotal: null });
        (0, vitest_1.expect)(await service.summary(ctx, {})).toEqual({
            count: 0, originalTotal: 0, discountTotal: 0, finalTotal: 0,
        });
    });
});
//# sourceMappingURL=in-store-bill.service.spec.js.map