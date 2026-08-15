import { describe, it, expect, vi } from 'vitest';
import { ServiceNotifyConfigService } from './service-notify-config.service';

const mockChannelService: any = {
    findOne: vi.fn().mockResolvedValue({
        customFields: {
            serviceNotifyConfig: {
                wecomCorpSecret: 'enc:abc',
                wecomEnabled: true,
            },
        },
    }),
    update: vi.fn().mockResolvedValue({}),
};

describe('ServiceNotifyConfigService', () => {
    it('masks secret on get', async () => {
        const svc = new ServiceNotifyConfigService(mockChannelService);
        const result = await svc.getMasked({} as any, '1');
        expect(result?.wecomCorpSecret).toBe('***');
    });

    it('preserves existing secret when incoming is ***', async () => {
        const svc = new ServiceNotifyConfigService(mockChannelService);
        const result = await svc.update({} as any, '1', { wecomCorpSecret: '***', wecomEnabled: false });
        expect(result?.wecomEnabled).toBe(false);
    });
});