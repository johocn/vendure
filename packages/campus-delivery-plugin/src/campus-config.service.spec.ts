// 纯逻辑单测：默认配置兜底
import { describe, expect, it, vi } from 'vitest';
import { CampusConfigService } from './campus-config.service';

describe('CampusConfigService.getConfig', () => {
    it('无配置时创建默认配置', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const save = vi.fn().mockImplementation(v => Promise.resolve(v));
        const svc = new CampusConfigService({ getRepository: () => ({ findOne, save }) } as any);
        const ctx = { channelId: 1 } as any;
        const cfg = await svc.getConfig(ctx);
        expect(save).toHaveBeenCalledOnce();
        expect(cfg.riderCommissionRate).toBe(100);
        expect(cfg.autoAssignMinutes).toBe(10);
        expect(cfg.paused).toBe(false);
    });
});
