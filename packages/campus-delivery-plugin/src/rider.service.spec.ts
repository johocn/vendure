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
