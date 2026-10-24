// 纯逻辑单测：覆盖 assertApprovedRider 三个断言分支（非骑手/待审拒、低信用分拒）
import { describe, expect, it, vi } from 'vitest';
import { RiderService } from './rider.service';

describe('RiderService.assertApprovedRider', () => {
    const make = (cf: any) => {
        const svc = new RiderService({} as any, {
            findOneByUserId: vi.fn().mockResolvedValue({ id: 1, customFields: cf }),
        } as any);
        return svc.assertApprovedRider({ channelId: 1, activeUserId: 1 } as any);
    };
    it('approved 且信用分达标通过', async () =>
        expect(make({ riderStatus: 'approved', riderCredit: 100 })).resolves.toBeTruthy());
    it('pending 拒绝', async () => expect(make({ riderStatus: 'pending', riderCredit: 100 })).rejects.toThrow());
    it('信用分低于 60 拒绝', async () => expect(make({ riderStatus: 'approved', riderCredit: 59 })).rejects.toThrow());
});

// 上下线开关：未过审账号不得写心跳（避免污染在线运力口径）
describe('RiderService.setOnline 审核态防护', () => {
    const make = (riderStatus: string) => {
        const update = vi.fn().mockResolvedValue({});
        const svc = new RiderService(
            { getRepository: vi.fn().mockReturnValue({ update }) } as any,
            { findOneByUserId: vi.fn().mockResolvedValue({ id: 1, customFields: { riderStatus } }) } as any,
        );
        return { svc, update };
    };

    it('approved 可上线并写心跳', async () => {
        const { svc, update } = make('approved');
        await expect(svc.setOnline({ channelId: 1, activeUserId: 1 } as any, true)).resolves.toEqual({ online: true });
        expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
            customFields: expect.objectContaining({ riderOnlineAt: expect.any(Date) }),
        }));
    });

    it('none/pending/suspended 上线被拒且不写心跳', async () => {
        for (const st of ['none', 'pending', 'suspended']) {
            const { svc, update } = make(st);
            await expect(svc.setOnline({ channelId: 1, activeUserId: 1 } as any, true)).rejects.toThrow();
            expect(update).not.toHaveBeenCalled();
        }
    });

    it('下线不受审核态限制（清心跳）', async () => {
        const { svc, update } = make('suspended');
        await expect(svc.setOnline({ channelId: 1, activeUserId: 1 } as any, false)).resolves.toEqual({ online: false });
        expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ customFields: { riderOnlineAt: null } }));
    });
});

// 入驻申请状态保护：待审可重新提交；已通过仅更新资料；已停用不得自助复申请
describe('RiderService.applyRider 状态保护', () => {
    const make = (riderStatus: string) => {
        const update = vi.fn().mockResolvedValue({});
        const svc = new RiderService(
            { getRepository: vi.fn().mockReturnValue({ update }) } as any,
            { findOneByUserId: vi.fn().mockResolvedValue({ id: 1, customFields: { riderStatus } }) } as any,
        );
        return { svc, update };
    };
    const input = { realName: '张三', studentNo: '2024001', campus: '本部' };

    it('首次申请（none）→ pending', async () => {
        const { svc, update } = make('none');
        await expect(svc.applyRider({ channelId: 1, activeUserId: 1 } as any, input)).resolves.toEqual({ status: 'pending' });
        expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ customFields: expect.objectContaining({ riderStatus: 'pending' }) }));
    });

    it('已通过审核重新提交 → 保留 approved（不被打回待审）', async () => {
        const { svc, update } = make('approved');
        await expect(svc.applyRider({ channelId: 1, activeUserId: 1 } as any, input)).resolves.toEqual({ status: 'approved' });
        expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ customFields: expect.objectContaining({ riderStatus: 'approved', riderRealName: '张三' }) }));
    });

    it('已停用 → 拒绝复申请（防绕过停用）', async () => {
        const { svc, update } = make('suspended');
        await expect(svc.applyRider({ channelId: 1, activeUserId: 1 } as any, input)).rejects.toThrow('骑手账号已停用');
        expect(update).not.toHaveBeenCalled();
    });
});

// 入参校验 + 状态白名单（P3-12）：无长度约束的 customFields 不得被超长/空值写入
describe('RiderService.applyRider 入参校验 / setRiderStatus（P3）', () => {
    const make = (riderStatus = 'none', inChannel = true) => {
        const update = vi.fn().mockResolvedValue({});
        const getOne = vi.fn().mockResolvedValue(inChannel ? { id: 1 } : null);
        const qb: any = {
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getOne,
        };
        const svc = new RiderService(
            {
                getRepository: vi.fn().mockReturnValue({
                    update,
                    createQueryBuilder: vi.fn().mockReturnValue(qb),
                }),
            } as any,
            { findOneByUserId: vi.fn().mockResolvedValue({ id: 1, customFields: { riderStatus } }) } as any,
        );
        return { svc, update, qb };
    };

    it('姓名/学号/校区为空（含纯空格）→ 拒绝', async () => {
        const { svc, update } = make();
        await expect(
            svc.applyRider({ channelId: 1, activeUserId: 1 } as any, { realName: '  ', studentNo: '2024001', campus: '本部' }),
        ).rejects.toThrow('请填写姓名、学号和校区');
        expect(update).not.toHaveBeenCalled();
    });

    it('超长字段 → 拒绝；正常入参 trim 后落库', async () => {
        const { svc, update } = make();
        await expect(
            svc.applyRider({ channelId: 1, activeUserId: 1 } as any, {
                realName: 'a'.repeat(31), studentNo: '2024001', campus: '本部',
            }),
        ).rejects.toThrow('30 个字符');
        await expect(
            svc.applyRider({ channelId: 1, activeUserId: 1 } as any, {
                realName: '张三', studentNo: '2024001', campus: '本部', idImg: 'x'.repeat(501),
            }),
        ).rejects.toThrow('证件图片地址不合法');
        await svc.applyRider({ channelId: 1, activeUserId: 1 } as any, { realName: ' 张三 ', studentNo: ' 2024001 ', campus: ' 本部 ' });
        expect(update).toHaveBeenCalledWith(1, {
            customFields: expect.objectContaining({ riderRealName: '张三', riderStudentNo: '2024001', riderCampus: '本部', riderIdImg: null }),
        });
    });

    it('setRiderStatus 非白名单状态 → 拒绝', async () => {
        const { svc, update } = make();
        await expect(svc.setRiderStatus({ channelId: 1 } as any, 1, 'hacked' as any)).rejects.toThrow('骑手状态不合法');
        expect(update).not.toHaveBeenCalled();
    });

    it('setRiderStatus 停用/重置 → 同时清 riderOnlineAt 强制下线', async () => {
        const { svc, update } = make('approved');
        await svc.setRiderStatus({ channelId: 1 } as any, 1, 'suspended');
        expect(update).toHaveBeenCalledWith(1, { customFields: { riderStatus: 'suspended', riderOnlineAt: null } });
        await svc.setRiderStatus({ channelId: 1 } as any, 1, 'approved');
        expect(update).toHaveBeenLastCalledWith(1, { customFields: { riderStatus: 'approved' } });
    });

    it('setRiderStatus 骑手不属于当前渠道 → 拒绝（防跨店停用）', async () => {
        const { svc, update } = make('approved', false);
        await expect(svc.setRiderStatus({ channelId: 1 } as any, 1, 'suspended')).rejects.toThrow('骑手不存在或不属于当前店铺');
        expect(update).not.toHaveBeenCalled();
    });
});
// F8 审核列表分页：skip/take 透传 QueryBuilder，返回 { items, total }
describe('RiderService.listApplications（F8 分页）', () => {
    it('skip/take 透传并返回 items+total', async () => {
        const qb: any = {
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[{ id: 1 }], 1]),
        };
        const conn = {
            getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }),
        } as any;
        const svc = new RiderService(conn, {} as any);
        const out = await svc.listApplications({ channelId: 1 } as any, 'pending', 50, 25);
        expect(qb.skip).toHaveBeenCalledWith(50);
        expect(qb.take).toHaveBeenCalledWith(25);
        expect(qb.orderBy).toHaveBeenCalled();
        expect(out).toEqual({ items: [{ id: 1 }], total: 1 });
    });

    it('缺省参数：skip=0 / take=200 兜底防全量', async () => {
        const qb: any = {
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        const conn = { getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }) } as any;
        const svc = new RiderService(conn, {} as any);
        await svc.listApplications({ channelId: 1 } as any, 'approved');
        expect(qb.skip).toHaveBeenCalledWith(0);
        expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('参数钳制：负数 take → 1，超大 take → 500，负 skip → 0', async () => {
        const qb: any = {
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        };
        const conn = { getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => qb }) } as any;
        const svc = new RiderService(conn, {} as any);
        await svc.listApplications({ channelId: 1 } as any, 'approved', -5, -1);
        expect(qb.skip).toHaveBeenCalledWith(0);
        expect(qb.take).toHaveBeenCalledWith(1);
        await svc.listApplications({ channelId: 1 } as any, 'approved', 0, 100000);
        expect(qb.take).toHaveBeenLastCalledWith(500);
    });
});
