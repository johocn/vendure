"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAfterSalesThresholds = resolveAfterSalesThresholds;
const core_1 = require("@vendure/core");
const DEFAULTS = { timeoutHours: 48, autoApproveHours: 0, refundAutoRetry: 1 };
/**
 * 解析售后自动化阈值：渠道 customFields → 插件 options → 内建默认（48 / 0 / 1）。
 * 事件 ctx.channel 已加载 customFields 时直接取；否则回退查库。
 */
async function resolveAfterSalesThresholds(injector, ctx, channelId, options) {
    var _a;
    let cf = ctx ? (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields : undefined;
    if (!cf) {
        try {
            const channelService = injector.get(core_1.ChannelService);
            const channel = await channelService.findOne(core_1.RequestContext.empty(), channelId);
            cf = channel === null || channel === void 0 ? void 0 : channel.customFields;
        }
        catch (_b) {
            cf = undefined;
        }
    }
    const pick = (v, o, d) => {
        var _a;
        const n = Number((_a = v !== null && v !== void 0 ? v : o) !== null && _a !== void 0 ? _a : d);
        return Number.isFinite(n) && n >= 0 ? n : d;
    };
    return {
        timeoutHours: pick(cf === null || cf === void 0 ? void 0 : cf.afterSalesTimeoutHours, options.afterSalesTimeoutHours, DEFAULTS.timeoutHours),
        autoApproveHours: pick(cf === null || cf === void 0 ? void 0 : cf.afterSalesAutoApproveHours, options.afterSalesAutoApproveHours, DEFAULTS.autoApproveHours),
        refundAutoRetry: pick(cf === null || cf === void 0 ? void 0 : cf.afterSalesRefundAutoRetry, options.afterSalesRefundAutoRetry, DEFAULTS.refundAutoRetry),
    };
}
//# sourceMappingURL=after-sales-config.js.map