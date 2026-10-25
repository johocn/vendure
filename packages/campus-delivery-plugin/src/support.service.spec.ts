// 工单/申诉提醒单测：新工单/新申诉 → 飞书店铺定向提醒；回复/审核结果 → 站内信（Message+MessageDelivery）
import { describe, expect, it, vi } from 'vitest';
import { SupportService } from './support.service';

const ctx = {
    channelId: 1,
    activeUserId: 99,
    channel: { id: 1, code: 'canteen-a' },
} as any;

function make(overrides?: { messageSaveThrows?: boolean; validCustomers?: number[]; blacklistExists?: any[] }) {
    const customer = {
        id: 5,
        firstName: '张',
        lastName: '三',
        phoneNumber: '13800000000',
        customFields: { riderStatus: 'approved', riderRealName: '张三骑手' },
    } as any;
    const customerService = { findOneByUserId: vi.fn().mockResolvedValue(customer) } as any;
    const credit = { adjust: vi.fn().mockResolvedValue(undefined) } as any;
    const feishu = { pushEvent: vi.fn().mockResolvedValue(true) } as any;

    const saved: { entity: string; value: any }[] = [];
    const blacklistSaved: any[] = [];
    const blacklistUpdated: any[] = [];
    const existingRows = [...(overrides?.blacklistExists ?? [])];
    const repos: Record<string, any> = {
        CampusSupportTicket: {
            save: vi.fn((v: any) => Promise.resolve({ id: 11, ...v })),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
            findOne: vi.fn(),
        },
        CampusRiderAppeal: {
            save: vi.fn((v: any) => Promise.resolve({ id: 21, ...v })),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
            findOne: vi.fn(),
        },
        CampusBlacklist: {
            findOne: vi.fn(() => Promise.resolve(existingRows.shift() ?? null)),
            save: vi.fn((v: any) => {
                blacklistSaved.push(v);
                return Promise.resolve({ id: 300 + blacklistSaved.length, ...v });
            }),
            update: vi.fn((id: any, patch: any) => {
                blacklistUpdated.push({ id, patch });
                return Promise.resolve({ affected: 1 });
            }),
        },
        Customer: {
            createQueryBuilder: vi.fn(() => ({
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                andWhere: vi.fn().mockReturnThis(),
                getMany: vi.fn().mockResolvedValue(
                    (overrides?.validCustomers ?? []).map(id => ({ id })),
                ),
            })),
        },
        Message: {
            create: vi.fn((v: any) => v),
            save: vi.fn((v: any) => {
                if (overrides?.messageSaveThrows) return Promise.reject(new Error('no message table'));
                saved.push({ entity: 'Message', value: v });
                return Promise.resolve({ id: 101, ...v });
            }),
        },
        MessageDelivery: {
            create: vi.fn((v: any) => v),
            save: vi.fn((v: any) => {
                saved.push({ entity: 'MessageDelivery', value: v });
                return Promise.resolve({ id: 201, ...v });
            }),
        },
    };
    const connection = {
        getRepository: vi.fn((_ctx: any, entity: any) =>
            repos[typeof entity === 'string' ? entity : entity.name] ?? {}),
    } as any;

    const svc = new SupportService(connection, customerService, credit, feishu);
    return { svc, repos, saved, credit, feishu, blacklistSaved, blacklistUpdated };
}

describe('SupportService 提醒', () => {
    it('新工单推飞书并带店铺定向', async () => {
        const { svc, feishu } = make();
        const ticket = await svc.createTicket(ctx, {
            category: 'delivery',
            content: '骑手把餐放错了楼栋',
            orderCode: 'A12345678',
        });
        expect(ticket).toMatchObject({ id: 11, status: 'open' });
        await vi.waitFor(() => expect(feishu.pushEvent).toHaveBeenCalledTimes(1));
        const [scene, title, content, orderCode, dedupe, target] = feishu.pushEvent.mock.calls[0];
        expect(scene).toBe('support_ticket');
        expect(title).toBe('新客服工单');
        expect(content).toContain('类型：delivery');
        expect(content).toContain('张 三');
        expect(content).toContain('A12345678');
        expect(orderCode).toBe('A12345678');
        expect(dedupe).toBe('ticket:11');
        expect(target).toEqual({ channel: 'canteen-a' });
    });

    it('新申诉推飞书并带骑手名', async () => {
        const { svc, repos, feishu } = make();
        repos.CampusRiderAppeal.findOne.mockResolvedValue(null);
        await svc.createAppeal(ctx, { reason: '客户地址错误导致超时' });
        await vi.waitFor(() => expect(feishu.pushEvent).toHaveBeenCalledTimes(1));
        const [scene, title, content, , dedupe, target] = feishu.pushEvent.mock.calls[0];
        expect(scene).toBe('rider_appeal');
        expect(title).toBe('新骑手申诉');
        expect(content).toContain('张三骑手');
        expect(content).toContain('未关联');
        expect(dedupe).toBe('appeal:21');
        expect(target).toEqual({ channel: 'canteen-a' });
    });

    it('回复工单给顾客发站内信', async () => {
        const { svc, repos, saved } = make();
        repos.CampusSupportTicket.findOne.mockResolvedValue({
            id: 11, channelId: 1, customerId: 5, status: 'open', reply: null,
        });
        await svc.replyTicket(ctx, 11, '已联系骑手补送');
        const msg = saved.find(s => s.entity === 'Message')?.value;
        const delivery = saved.find(s => s.entity === 'MessageDelivery')?.value;
        expect(msg).toMatchObject({
            title: '客服工单已回复',
            deliveryChannel: 'inapp',
            audienceType: 'all',
            status: 'sent',
            totalTarget: 1,
            totalSent: 1,
        });
        expect(msg.body).toContain('已联系骑手补送');
        expect(msg.body).toContain('#11');
        expect(delivery).toMatchObject({ messageId: 101, customerId: 5, deliveryStatus: 'sent' });
    });

    it('关闭工单给顾客发关闭站内信', async () => {
        const { svc, repos, saved } = make();
        repos.CampusSupportTicket.findOne.mockResolvedValue({
            id: 11, channelId: 1, customerId: 5, status: 'open', reply: '已处理',
        });
        await svc.replyTicket(ctx, 11, undefined, 'closed');
        const msg = saved.find(s => s.entity === 'Message')?.value;
        expect(msg.title).toBe('客服工单已关闭');
    });

    it('申诉通过回补信用分并通知骑手', async () => {
        const { svc, repos, saved, credit } = make();
        repos.CampusRiderAppeal.findOne.mockResolvedValue({
            id: 21, channelId: 1, riderCustomerId: 5, status: 'pending', orderId: 88, orderCode: 'A12345678',
        });
        await svc.reviewAppeal(ctx, 21, true, 15, '核实无责');
        expect(credit.adjust).toHaveBeenCalledWith(ctx, 5, 15, 'appeal_approved', 88);
        const msg = saved.find(s => s.entity === 'Message')?.value;
        expect(msg.title).toBe('骑手申诉已通过');
        expect(msg.body).toContain('信用分 +15');
        expect(msg.body).toContain('核实无责');
        expect(saved.find(s => s.entity === 'MessageDelivery')?.value.customerId).toBe(5);
    });

    it('申诉驳回只通知、不回补信用分', async () => {
        const { svc, repos, saved, credit } = make();
        repos.CampusRiderAppeal.findOne.mockResolvedValue({
            id: 21, channelId: 1, riderCustomerId: 5, status: 'pending', orderId: null, orderCode: null,
        });
        await svc.reviewAppeal(ctx, 21, false, 10, '证据不足');
        expect(credit.adjust).not.toHaveBeenCalled();
        const msg = saved.find(s => s.entity === 'Message')?.value;
        expect(msg.title).toBe('骑手申诉未通过');
        expect(msg.body).toContain('信用分不变');
        expect(msg.body).toContain('证据不足');
    });

    it('站内信不可用（无 message-plugin）不影响工单回复', async () => {
        const { svc, repos } = make({ messageSaveThrows: true });
        repos.CampusSupportTicket.findOne.mockResolvedValue({
            id: 11, channelId: 1, customerId: 5, status: 'open', reply: null,
        });
        await expect(svc.replyTicket(ctx, 11, '已处理')).resolves.toMatchObject({ status: 'replied' });
    });
});

// P3-2 批量导入：格式非法/重复/已存在/非本店用户分别计数
describe('SupportService.importBlacklist', () => {
    it('手机号批量导入：非法行计 invalid，重复行去重', async () => {
        const { svc, blacklistSaved } = make();
        const res = await svc.importBlacklist(ctx, 'phone', ['13800000000', 'bad', '13800000000', ' 139 0000 0000 ']);
        expect(res).toEqual({ added: 2, skipped: 0, invalid: 1 });
        expect(blacklistSaved.map(v => v.phone)).toEqual(['13800000000', '13900000000']);
        expect(blacklistSaved[0]).toMatchObject({ channelId: 1, type: 'phone', createdBy: '99', active: true });
    });

    it('用户 ID 批量导入：不存在/非本店铺计 invalid', async () => {
        const { svc, blacklistSaved } = make({ validCustomers: [5] });
        const res = await svc.importBlacklist(ctx, 'user', ['5', '7', 'abc']);
        expect(res).toEqual({ added: 1, skipped: 0, invalid: 2 });
        expect(blacklistSaved).toHaveLength(1);
        expect(blacklistSaved[0]).toMatchObject({ type: 'user', customerId: 5, phone: null });
    });

    it('已存在的生效记录计入 skipped；已删除记录重新激活计入 added', async () => {
        const { svc, blacklistSaved, blacklistUpdated } = make({
            validCustomers: [5, 7],
            blacklistExists: [{ id: 41, active: true }, { id: 42, active: false }],
        });
        const res = await svc.importBlacklist(ctx, 'user', ['5', '7'], '活动刷单');
        expect(res).toEqual({ added: 1, skipped: 1, invalid: 0 });
        expect(blacklistUpdated).toEqual([{ id: 42, patch: { active: true, reason: '活动刷单' } }]);
        expect(blacklistSaved).toHaveLength(0);
    });

    it('空列表与超量导入直接拒绝', async () => {
        const { svc } = make();
        await expect(svc.importBlacklist(ctx, 'phone', [])).rejects.toThrow('请粘贴要导入的用户 ID 或手机号');
        await expect(svc.importBlacklist(ctx, 'phone', Array.from({ length: 501 }, (_, i) => `138${i}`))).rejects.toThrow('单次最多导入 500 条');
        await expect(svc.importBlacklist(ctx, 'email' as any, ['a@b.c'])).rejects.toThrow('黑名单类型不合法');
    });
});

