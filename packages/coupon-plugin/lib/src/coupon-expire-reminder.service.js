"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponExpireReminderService = void 0;
exports.expireStage = expireStage;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_template_entity_1 = require("./coupon-template.entity");
const localize_1 = require("./localize");
const coupon_expire_reminder_events_1 = require("./coupon-expire-reminder.events");
const DAY_MS = 24 * 60 * 60 * 1000;
const loggerCtx = 'CouponExpireReminderService';
/**
 * 距过期的提醒阶段（纯函数，SSR/任务双端一致）：
 *  - 已过期（t<=0）或距到期 > 3 天 → null（不提醒）；
 *  - <= 1 天 → '1d'；<= 3 天 → '3d'（PRD FR-A2：到期前 3 天 / 1 天各提醒一次）。
 */
function expireStage(expiredAt, now) {
    const t = expiredAt.getTime() - now.getTime();
    if (t <= 0)
        return null;
    if (t <= DAY_MS)
        return '1d';
    if (t <= 3 * DAY_MS)
        return '3d';
    return null;
}
/**
 * 券过期提醒扫描（FR-A2）：
 * 周期扫描各渠道 status∈(UNUSED,RETURNED) 且 expiredAt 落入 3 天 / 1 天窗口的领券记录，
 * 逐条发布 CouponExpireRemindEvent；触达通道与 R4 防骚扰在 notification-plugin 订阅侧统一处理
 * （重复发布由订阅侧 7 天去重兜底，扫描幂等可重入）。
 */
let CouponExpireReminderService = class CouponExpireReminderService {
    constructor(connection, eventBus) {
        this.connection = connection;
        this.eventBus = eventBus;
    }
    /** 全渠道扫描（定时环境无请求 ctx：列全部渠道后逐渠道建 admin ctx） */
    async remindAllChannels() {
        var _a;
        const channels = await this.connection.rawConnection.getRepository(core_2.Channel).find();
        let scanned = 0;
        let published = 0;
        for (const channel of channels) {
            const ctx = new core_1.RequestContext({
                apiType: 'admin',
                channel: channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const r = await this.remindChannel(ctx);
                scanned += r.scanned;
                published += r.published;
            }
            catch (e) {
                core_1.Logger.error(`remind channel ${channel.id} failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
            }
        }
        if (published > 0) {
            core_1.Logger.info(`Coupon expire reminder: scanned ${scanned}, published ${published} across ${channels.length} channels`, loggerCtx);
        }
        return { channels: channels.length, scanned, published };
    }
    /** 单渠道扫描并发布提醒事件：一次 3 天窗口扫描，stage（3d/1d）按剩余时间逐行判定 */
    async remindChannel(ctx) {
        var _a, _b;
        const now = new Date();
        const rows = await this.scanChannel(ctx, now, 3);
        let published = 0;
        for (const row of rows) {
            const stage = expireStage(new Date(row.expiredAt), now);
            if (!stage)
                continue;
            this.eventBus.publish(new coupon_expire_reminder_events_1.CouponExpireRemindEvent(ctx, {
                customerId: Number(row.customerId),
                templateId: Number(row.templateId),
                templateName: (0, localize_1.localizeText)(((_a = row.name) !== null && _a !== void 0 ? _a : undefined), (_b = ctx.languageCode) !== null && _b !== void 0 ? _b : core_1.LanguageCode.zh_Hans),
                couponCode: row.code,
                expiresAt: new Date(row.expiredAt),
                stage,
            }));
            published++;
        }
        return { scanned: rows.length, published };
    }
    /** 本渠道 status∈(UNUSED,RETURNED)、expiredAt∈(now, now+days] 的领券记录（createdAt 过滤下推 SQL 层同法：窗口条件全下推） */
    async scanChannel(ctx, now, days) {
        const horizon = new Date(now.getTime() + days * DAY_MS);
        return this.connection
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .createQueryBuilder('cc')
            .innerJoin(coupon_template_entity_1.CouponTemplate, 'tpl', 'tpl.id = cc.templateId')
            .innerJoin('tpl.channels', 'ch', 'ch.id = :channelId', { channelId: ctx.channelId })
            .where('cc.status IN (:...statuses)', { statuses: ['UNUSED', 'RETURNED'] })
            .andWhere('cc.expiredAt IS NOT NULL')
            .andWhere('cc.expiredAt > :now', { now })
            .andWhere('cc.expiredAt <= :horizon', { horizon })
            .select([
            'cc.id AS id',
            'cc.customerId AS customerId',
            'cc.code AS code',
            'cc.expiredAt AS expiredAt',
            'tpl.id AS templateId',
            'tpl.name AS name',
        ])
            .getRawMany();
    }
};
exports.CouponExpireReminderService = CouponExpireReminderService;
exports.CouponExpireReminderService = CouponExpireReminderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.EventBus])
], CouponExpireReminderService);
//# sourceMappingURL=coupon-expire-reminder.service.js.map