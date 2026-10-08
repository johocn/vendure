"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendScheduleNotice = sendScheduleNotice;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const payment_schedule_runtime_1 = require("./payment-schedule-runtime");
/**
 * 调度通知：模板 id 从渠道 customFields 读取（与 orderPaidTemplateId 同机制），
 * 经 wechat-subscribe-message-plugin 的 SubscribeMessageService.sendCustomMessage 发送。
 * 软依赖：插件未安装 / 渠道未配置模板 / 无 openid 一律静默跳过。
 */
async function sendScheduleNotice(ctx, order, templateKey, data) {
    var _a, _b, _c;
    try {
        if (!(order === null || order === void 0 ? void 0 : order.customer))
            return;
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        const templateId = cf[templateKey];
        if (!templateId) {
            core_1.Logger.debug(`Channel ${ctx.channelId} has no ${templateKey}, skip schedule notice`, constants_1.loggerCtx);
            return;
        }
        const svc = (0, payment_schedule_runtime_1.tryGetProvider)(require('@vendure/wechat-subscribe-message-plugin').SubscribeMessageService);
        if (!svc) {
            core_1.Logger.debug('wechat-subscribe-message-plugin not installed, skip schedule notice', constants_1.loggerCtx);
            return;
        }
        await svc.sendCustomMessage(ctx, order.customer.id, templateId, data);
    }
    catch (e) {
        core_1.Logger.warn(`Schedule notice failed for order ${order === null || order === void 0 ? void 0 : order.code}: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, constants_1.loggerCtx);
    }
}
