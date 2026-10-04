"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：默认配置兜底
const vitest_1 = require("vitest");
const campus_config_service_1 = require("./campus-config.service");
(0, vitest_1.describe)('CampusConfigService.getConfig', () => {
    (0, vitest_1.it)('无配置时创建默认配置', async () => {
        const findOne = vitest_1.vi.fn().mockResolvedValue(null);
        const save = vitest_1.vi.fn().mockImplementation(v => Promise.resolve(v));
        const svc = new campus_config_service_1.CampusConfigService({ getRepository: () => ({ findOne, save }) });
        const ctx = { channelId: 1 };
        const cfg = await svc.getConfig(ctx);
        (0, vitest_1.expect)(save).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(cfg.riderCommissionRate).toBe(100);
        (0, vitest_1.expect)(cfg.autoAssignMinutes).toBe(10);
        (0, vitest_1.expect)(cfg.paused).toBe(false);
    });
});
//# sourceMappingURL=campus-config.service.spec.js.map