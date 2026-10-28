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
exports.CampusDeliveryPlugin = void 0;
const core_1 = require("@vendure/core");
const core_2 = require("@nestjs/core");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const notification_plugin_1 = require("@vendure/notification-plugin");
const campus_building_entity_1 = require("./campus-building.entity");
const blacklist_scan_job_1 = require("./blacklist-scan.job");
const capacity_alert_job_1 = require("./capacity-alert.job");
const capacity_service_1 = require("./capacity.service");
const campus_config_admin_resolver_1 = require("./campus-config-admin.resolver");
const campus_config_service_1 = require("./campus-config.service");
const campus_sms_service_1 = require("./campus-sms.service");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const custom_fields_1 = require("./custom-fields");
const delivery_slot_entity_1 = require("./delivery-slot.entity");
const order_gate_process_1 = require("./order-gate.process");
const support_entities_1 = require("./support.entities");
const chat_entities_1 = require("./chat.entities");
const chat_service_1 = require("./chat.service");
const chat_admin_resolver_1 = require("./chat-admin.resolver");
const chat_shop_resolver_1 = require("./chat-shop.resolver");
const rider_ops_entities_1 = require("./rider-ops.entities");
const p7_ops_tables_1 = require("./migrations/p7-ops-tables");
const p8_p0_privacy_food_safety_1 = require("./migrations/p8-p0-privacy-food-safety");
const p8_p1_packing_fee_1 = require("./migrations/p8-p1-packing-fee");
const p8_p1_2_addon_combo_1 = require("./migrations/p8-p1-2-addon-combo");
const p8_p1_4_cloud_print_kds_1 = require("./migrations/p8-p1-4-cloud-print-kds");
const p9_p2_mp_listing_1 = require("./migrations/p9-p2-mp-listing");
const p9_p2_search_assist_1 = require("./migrations/p9-p2-search-assist");
const p9_p3_ad_campaign_1 = require("./migrations/p9-p3-ad-campaign");
const campus_ad_entity_1 = require("./campus-ad.entity");
const campus_ad_service_1 = require("./campus-ad.service");
const campus_ad_resolver_1 = require("./campus-ad.resolver");
const campus_locker_entity_1 = require("./campus-locker.entity");
const campus_locker_service_1 = require("./campus-locker.service");
const campus_locker_resolver_1 = require("./campus-locker.resolver");
const p9_p4_locker_1 = require("./migrations/p9-p4-locker");
const p9_p5_rider_compliance_1 = require("./migrations/p9-p5-rider-compliance");
const p9_p6_taste_profile_1 = require("./migrations/p9-p6-taste-profile");
const p9_p7_delivery_fee_tiers_1 = require("./migrations/p9-p7-delivery-fee-tiers");
const p10_review_alert_1 = require("./migrations/p10-review-alert");
const p11_soldout_auto_restore_1 = require("./migrations/p11-soldout-auto-restore");
const soldout_auto_restore_job_1 = require("./soldout-auto-restore.job");
const taste_profile_shop_resolver_1 = require("./taste-profile-shop.resolver");
const cloud_print_service_1 = require("./cloud-print.service");
const campus_print_job_entity_1 = require("./campus-print-job.entity");
const addon_fee_process_1 = require("./addon-fee.process");
const privacy_number_service_1 = require("./privacy-number.service");
const add_withdraw_payout_1 = require("./migrations/add-withdraw-payout");
const add_rider_location_1 = require("./migrations/add-rider-location");
const campus_rider_location_entity_1 = require("./campus-rider-location.entity");
const rider_ledger_admin_resolver_1 = require("./rider-ledger-admin.resolver");
const rider_ledger_service_1 = require("./rider-ledger.service");
const rider_ops_service_1 = require("./rider-ops.service");
const support_admin_resolver_1 = require("./support-admin.resolver");
const support_service_1 = require("./support.service");
const support_shop_resolver_1 = require("./support-shop.resolver");
const dispatch_admin_resolver_1 = require("./dispatch-admin.resolver");
const dispatch_admin_service_1 = require("./dispatch-admin.service");
const dispatch_job_service_1 = require("./dispatch-job.service");
const delivery_stats_resolver_1 = require("./delivery-stats.resolver");
const delivery_stats_service_1 = require("./delivery-stats.service");
const sales_stats_resolver_1 = require("./sales-stats.resolver");
const sales_stats_service_1 = require("./sales-stats.service");
const address_change_resolver_1 = require("./address-change.resolver");
const address_change_service_1 = require("./address-change.service");
const campus_address_change_entity_1 = require("./campus-address-change.entity");
const add_address_change_pricing_1 = require("./migrations/add-address-change-pricing");
const add_address_change_settle_proof_1 = require("./migrations/add-address-change-settle-proof");
const p3_data_cleanup_1 = require("./migrations/p3-data-cleanup");
const p4_ops_hardening_1 = require("./migrations/p4-ops-hardening");
const p5_timestamp_timezone_1 = require("./migrations/p5-timestamp-timezone");
const p6_default_compensation_and_credit_recovery_1 = require("./migrations/p6-default-compensation-and-credit-recovery");
const errand_service_1 = require("./errand.service");
const errand_shop_resolver_1 = require("./errand-shop.resolver");
const favorite_shop_resolver_1 = require("./favorite-shop.resolver");
const feishu_card_service_1 = require("./feishu/feishu-card.service");
const feishu_client_1 = require("./feishu/feishu.client");
const feishu_command_service_1 = require("./feishu/feishu.command.service");
const feishu_config_1 = require("./feishu/feishu.config");
const feishu_controller_1 = require("./feishu/feishu.controller");
const feishu_digest_service_1 = require("./feishu/feishu.digest.service");
const feishu_event_service_1 = require("./feishu/feishu.event.service");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const errand_shipping_line_assignment_1 = require("./errand-shipping-line-assignment");
const hall_grab_service_1 = require("./hall-grab.service");
const hall_service_1 = require("./hall.service");
const hall_shop_resolver_1 = require("./hall-shop.resolver");
const campus_invoice_resolver_1 = require("./campus-invoice.resolver");
const create_campus_tables_1 = require("./migrations/create-campus-tables");
const backfill_waimai_industry_1 = require("./migrations/backfill-waimai-industry");
const add_route_delivery_config_1 = require("./migrations/add-route-delivery-config");
const add_third_party_base_fee_1 = require("./migrations/add-third-party-base-fee");
const cancel_guard_process_1 = require("./cancel-guard.process");
const min_order_process_1 = require("./min-order.process");
const packing_fee_process_1 = require("./packing-fee.process");
const payment_timeout_admin_resolver_1 = require("./payment-timeout-admin.resolver");
const payment_timeout_admin_service_1 = require("./payment-timeout-admin.service");
const payment_timeout_job_1 = require("./payment-timeout.job");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
const permissions_1 = require("./permissions");
const merchant_admin_resolver_1 = require("./merchant-admin.resolver");
const merchant_admin_service_1 = require("./merchant-admin.service");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
const campus_notify_service_1 = require("./campus-notify.service");
const r2_mark_service_1 = require("./r2-mark.service");
const r2_shop_resolver_1 = require("./r2-shop.resolver");
const r4_tag_service_1 = require("./r4-tag.service");
const shipping_profile_ensure_service_1 = require("./shipping-profile-ensure.service");
const rider_admin_resolver_1 = require("./rider-admin.resolver");
const rider_credit_log_entity_1 = require("./rider-credit-log.entity");
const rider_credit_service_1 = require("./rider-credit.service");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_service_1 = require("./rider.service");
const rider_shop_resolver_1 = require("./rider-shop.resolver");
const rider_task_service_1 = require("./rider-task.service");
const rider_task_shop_resolver_1 = require("./rider-task-shop.resolver");
const rider_wallet_service_1 = require("./rider-wallet.service");
const rider_withdrawal_entity_1 = require("./rider-withdrawal.entity");
const shipping_calculator_1 = require("./shipping-calculator");
const slot_lock_service_1 = require("./slot-lock.service");
const waimai_shop_resolver_1 = require("./waimai-shop.resolver");
const waimai_store_service_1 = require("./waimai-store.service");
const search_assist_service_1 = require("./search-assist.service");
const p11_telemetry_1 = require("./migrations/p11-telemetry");
const telemetry_entities_1 = require("./telemetry.entities");
const telemetry_resolver_1 = require("./telemetry.resolver");
const resume_payment_shop_resolver_1 = require("./resume-payment-shop.resolver");
const telemetry_service_1 = require("./telemetry.service");
// 待付款补偿扫描：原用 Vendure ScheduledTask，但生产为单进程（pm2 只跑 API、无 worker，
// dev-config 配 runTasksInWorkerOnly: true）→ ScheduledTask 从不执行，20 条超时任务曾因此
// 永久 PENDING、订单卡在 ArrangingPayment 11 天。改为 PaymentTimeoutJob 自管定时器
// （与 DispatchJobService / FeishuDigestService 同款部署形态）。
let CampusDeliveryPlugin = class CampusDeliveryPlugin {
    constructor(eventBus, hallService, r4TagService, moduleRef, notify, paymentTimeout, configService, slotLock, connection) {
        this.eventBus = eventBus;
        this.hallService = hallService;
        this.r4TagService = r4TagService;
        this.moduleRef = moduleRef;
        this.notify = notify;
        this.paymentTimeout = paymentTimeout;
        this.configService = configService;
        this.slotLock = slotLock;
        this.connection = connection;
    }
    /** vendure Injector 需由 ModuleRef 构造（插件模块类构造器不直接提供 Injector） */
    get injector() {
        return new core_1.Injector(this.moduleRef);
    }
    onApplicationBootstrap() {
        (0, shipping_calculator_1.bindCampusErrandCalculatorConnection)(this.injector.get(core_1.TransactionalConnection));
        (0, min_order_process_1.bindMinOrderConnection)(this.injector.get(core_1.TransactionalConnection));
        (0, packing_fee_process_1.bindPackingFeeDeps)(this.injector.get(core_1.TransactionalConnection), this.injector.get(core_1.OrderService));
        (0, addon_fee_process_1.bindAddonFeeDeps)(this.injector.get(core_1.TransactionalConnection), this.injector.get(core_1.OrderService));
        (0, order_gate_process_1.bindOrderGateConnection)(this.injector.get(core_1.TransactionalConnection));
        // 权限迁移（B 组漏项）：写操作拆出 CampusDispatch，给已持有看板权限的角色补授，防现有运营失权
        void this.grantDispatchPermission().catch(e => core_1.Logger.error(`grant CampusDispatch failed: ${String(e)}`, 'CampusDispatch'));
        // 待付款补偿任务：自管定时器（生产无 worker，ScheduledTask 不执行）
        const paymentTimeoutJob = this.injector.get(payment_timeout_job_1.PaymentTimeoutJob);
        paymentTimeoutJob
            .init()
            .then(() => paymentTimeoutJob.startCompensationLoop())
            .catch(e => core_1.Logger.error(`PaymentTimeout init failed: ${String(e)}`, 'PaymentTimeout'));
        // 沽清次日自动恢复（§66）：自管定时器，每日 04:00 把「全店沽清」批次恢复在售
        this.injector.get(soldout_auto_restore_job_1.SoldOutAutoRestoreJob).start();
        this.eventBus.ofType(core_1.OrderPlacedEvent).subscribe(({ ctx, order }) => {
            // 下单成功通知（waimai 流程下单即支付完成；进大厅逻辑同源）
            void this.h5BaseUrl(ctx).then(url => this.notify.user(ctx, order.id, 'orderPlaced', undefined, url));
        });
        // 支付闸门（A 组漏项）：进入 ArrangingPayment≠已支付，只有 Payment Authorized/Settled 才入厅，
        // 未支付订单不进大厅、不可被抢（15min 待付款窗口内的单不再占用运力）。
        this.eventBus.ofType(core_1.PaymentStateTransitionEvent).subscribe(({ ctx, toState, order }) => {
            if (toState !== 'Authorized' && toState !== 'Settled')
                return;
            this.hallService.onOrderPlaced(ctx, order).catch(e => core_1.Logger.error(String(e), 'CampusHall'));
        });
        // R4 到店自取打标（二期 §5.4）：store-pickup 运费方式订单在支付闸门补写 fulfillmentRoute；
        // 取消脱厅（3.3）：订单取消终态时清 hallStatus/指派字段，退出大厅与整组抢单链路；
        // 待付款任务：离开 ArrangingPayment 作废，进入 ArrangingPayment 登记
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(e => {
            var _a;
            this.r4TagService.tagR4(e).catch(err => core_1.Logger.error(`R4 tag failed: ${String(err)}`, 'CampusR4Tag'));
            if (e.toState === 'Cancelled') {
                // P3-2 取消归因：C 端顾客主动取消标记 customer（自动拉黑规则只统计该口径），
                // 其余为系统/运营取消（campusCause 已有归因标记的视为 system）
                void this.injector.get(core_1.OrderService).updateCustomFields(e.ctx, e.order.id, { campusCancelCause: e.ctx.apiType === 'shop' ? 'customer' : (((_a = e.order.customFields) === null || _a === void 0 ? void 0 : _a.campusCause) ? 'system' : 'ops') }).catch(err => core_1.Logger.warn(`Cancel cause tag failed: ${String(err)}`, 'CampusSupport'));
                // 已推给达达/美团的运单必须同步取消：按「取消外部运单 → 脱厅 → 释放时段」顺序串行，
                // 不能三者并行——并行时外部取消失败也已脱厅，外部骑手仍可能上门取餐造成餐损。
                // 整段异步执行，不阻塞事件总线；任一步失败只记日志，后续步骤照常执行。
                void (async () => {
                    await this.injector
                        .get(third_party_delivery_service_1.ThirdPartyDeliveryService)
                        .cancel(e.ctx, Number(e.order.id), 'order cancelled')
                        .catch(err => core_1.Logger.warn(`Cancel external delivery failed: ${String(err)}`, 'CampusHall'));
                    await this.hallService.exitHall(e.ctx, e.order)
                        .catch(err => core_1.Logger.error(`Hall exit failed: ${String(err)}`, 'CampusHall'));
                    await this.slotLock.unlock(e.ctx, Number(e.order.id))
                        .catch(err => core_1.Logger.warn(`Slot unlock failed: ${String(err)}`, 'CampusSlot'));
                })();
                // 用户本人主动取消不推（ctx.activeUserId 存在即本人操作）；商家/系统/超时取消才推
                if (!e.ctx.activeUserId) {
                    void this.h5BaseUrl(e.ctx).then(url => this.notify.user(e.ctx, e.order.id, 'orderCancelled', undefined, url));
                }
            }
            if (e.fromState === 'ArrangingPayment' && e.toState !== 'ArrangingPayment') {
                void this.paymentTimeout.cancelForOrder(Number(e.order.id)).catch(err => core_1.Logger.warn(String(err), 'PaymentTimeout'));
            }
            if (e.toState === 'ArrangingPayment') {
                void this.paymentTimeout
                    .scheduleForOrder(e.ctx, Number(e.order.id), Number(e.ctx.channelId), e.toState)
                    .catch(err => core_1.Logger.warn(`schedule payment timeout failed: ${String(err)}`, 'PaymentTimeout'));
            }
        });
        // 售后进度：Approved / Refunded / RefundFailed 三个用户侧节点（其余状态不推）
        this.eventBus.ofType(after_sales_plugin_1.AfterSalesStateTransitionEvent).subscribe(e => {
            const text = e.toState === 'Approved' ? '售后审核通过'
                : e.toState === 'Refunded' ? '退款已到账'
                    : e.toState === 'RefundFailed' ? '退款失败，请联系客服'
                        : null;
            if (!text)
                return;
            // dedupe 后缀用目标状态：同一售后单 Approved→Refunded 多条进度各推一条（固定键会把后续节点吞掉）
            void this.h5BaseUrl(e.ctx).then(url => this.notify.user(e.ctx, e.orderId, 'afterSales', text, url, e.toState));
        });
        this.injector.get(dispatch_job_service_1.DispatchJobService).start();
        // 运力预警：在线会话收口 + 待抢单量/在线骑手数告警（自管定时器，生产无 worker）
        this.injector.get(capacity_alert_job_1.CapacityAlertJob).start();
        // P3-2 黑名单自动规则：每日扫顾客主动取消次数达标者（阈值 0 = 关闭）
        this.injector.get(blacklist_scan_job_1.BlacklistAutoScanJob).start();
        // 管理消息推送：notification 发布 AdminNotifyEvent（新订单/售后），本插件订阅后转飞书群
        this.eventBus.ofType(notification_plugin_1.AdminNotifyEvent).subscribe(event => {
            void this.injector.get(feishu_notify_service_1.FeishuNotifyService).onAdminNotify(event);
        });
        // 每日经营汇总（UTC+8 定点，advisory lock + 群消息回读防重，零建表）
        this.injector.get(feishu_digest_service_1.FeishuDigestService).start();
    }
    /** 权限迁移：permissions 为 simple-array（逗号分隔），给持有 CampusViewDispatch 的角色补授 CampusDispatch。
     * 幂等；启动时执行，早于任何请求，不涉及权限缓存失效问题。 */
    async grantDispatchPermission() {
        var _a;
        const raw = this.connection.rawConnection;
        const rows = await raw.query(`SELECT id, permissions FROM role WHERE permissions LIKE '%CampusViewDispatch%'`);
        let granted = 0;
        for (const row of rows) {
            const perms = String((_a = row.permissions) !== null && _a !== void 0 ? _a : '')
                .split(',')
                .map(p => p.trim())
                .filter(Boolean);
            if (perms.includes(permissions_1.CampusPermissions.CampusDispatch))
                continue;
            perms.push(permissions_1.CampusPermissions.CampusDispatch);
            await raw.query(`UPDATE role SET permissions = $1 WHERE id = $2`, [perms.join(','), row.id]);
            granted += 1;
        }
        if (granted)
            core_1.Logger.info(`CampusDispatch granted to ${granted} role(s)`, 'CampusDispatch');
    }
    /** h5BaseUrl 取渠道配置（未配置返回 undefined，通知静默不带 url） */
    async h5BaseUrl(ctx) {
        var _a;
        try {
            const cfg = await this.configService.getConfig(ctx);
            return (_a = cfg === null || cfg === void 0 ? void 0 : cfg.h5BaseUrl) !== null && _a !== void 0 ? _a : undefined;
        }
        catch (_b) {
            return undefined;
        }
    }
};
exports.CampusDeliveryPlugin = CampusDeliveryPlugin;
exports.CampusDeliveryPlugin = CampusDeliveryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [campus_zone_entity_1.CampusZone, campus_building_entity_1.CampusBuilding, rider_earning_entity_1.RiderEarning, campus_fulfillment_config_entity_1.CampusFulfillmentConfig, delivery_slot_entity_1.DeliverySlot, rider_credit_log_entity_1.RiderCreditLog, rider_withdrawal_entity_1.RiderWithdrawalRequest, payment_timeout_entity_1.PaymentTimeoutTask, campus_address_change_entity_1.CampusAddressChange, support_entities_1.CampusSupportTicket, support_entities_1.CampusRiderAppeal, support_entities_1.CampusBlacklist, chat_entities_1.CampusChatConversation, chat_entities_1.CampusChatMessage, rider_ops_entities_1.CampusRiderShift, rider_ops_entities_1.CampusRiderSession, rider_ops_entities_1.CampusRiderReview, campus_rider_location_entity_1.CampusRiderLocation, campus_print_job_entity_1.CampusPrintJob, campus_ad_entity_1.CampusAdCampaign, campus_locker_entity_1.CampusLockerStation, telemetry_entities_1.CampusTrackEvent, telemetry_entities_1.CampusErrorReport],
        providers: [
            create_campus_tables_1.CreateCampusTablesMigration,
            add_route_delivery_config_1.AddRouteDeliveryConfigMigration,
            add_third_party_base_fee_1.AddThirdPartyBaseFeeMigration,
            add_address_change_pricing_1.AddAddressChangePricingMigration,
            add_address_change_settle_proof_1.AddAddressChangeSettleProofMigration,
            p3_data_cleanup_1.P3DataCleanupMigration,
            p4_ops_hardening_1.P4OpsHardeningMigration,
            p5_timestamp_timezone_1.P5TimestampTimezoneMigration,
            p6_default_compensation_and_credit_recovery_1.P6DefaultCompensationMigration,
            p7_ops_tables_1.P7OpsTablesMigration,
            p8_p0_privacy_food_safety_1.P8P0Migration,
            p8_p1_packing_fee_1.P8P1PackingFeeMigration,
            p8_p1_2_addon_combo_1.P8P1AddonComboMigration,
            p8_p1_4_cloud_print_kds_1.P8P1_4CloudPrintMigration,
            p9_p2_mp_listing_1.P9P2MpListingMigration,
            p9_p2_search_assist_1.P9P2SearchAssistMigration,
            p9_p3_ad_campaign_1.P9P3AdCampaignMigration,
            p9_p4_locker_1.P9P4LockerMigration,
            p9_p5_rider_compliance_1.P9P5RiderComplianceMigration,
            p9_p6_taste_profile_1.P9P6TasteProfileMigration,
            p9_p7_delivery_fee_tiers_1.P9P7DeliveryFeeTiersMigration,
            p10_review_alert_1.P10ReviewAlertMigration,
            p11_telemetry_1.P11TelemetryMigration,
            p11_soldout_auto_restore_1.P11SoldOutAutoRestoreMigration,
            soldout_auto_restore_job_1.SoldOutAutoRestoreJob,
            add_withdraw_payout_1.AddWithdrawPayoutMigration,
            add_rider_location_1.AddRiderLocationMigration,
            address_change_service_1.AddressChangeService,
            backfill_waimai_industry_1.BackfillWaimaiIndustryMigration,
            campus_config_service_1.CampusConfigService,
            rider_ops_service_1.RiderOpsService,
            support_service_1.SupportService,
            chat_service_1.ChatService,
            campus_sms_service_1.CampusSmsService,
            capacity_alert_job_1.CapacityAlertJob,
            blacklist_scan_job_1.BlacklistAutoScanJob,
            rider_service_1.RiderService,
            capacity_service_1.CapacityService,
            slot_lock_service_1.SlotLockService,
            hall_service_1.HallService,
            hall_grab_service_1.HallGrabService,
            rider_task_service_1.RiderTaskService,
            rider_credit_service_1.RiderCreditService,
            rider_wallet_service_1.RiderWalletService,
            rider_ledger_service_1.RiderLedgerService,
            dispatch_job_service_1.DispatchJobService,
            dispatch_admin_service_1.DispatchAdminService,
            delivery_stats_service_1.DeliveryStatsService,
            sales_stats_service_1.SalesStatsService,
            telemetry_service_1.TelemetryService,
            errand_service_1.ErrandService,
            r2_mark_service_1.R2MarkService,
            r4_tag_service_1.R4TagService,
            shipping_profile_ensure_service_1.ShippingProfileEnsureService,
            waimai_store_service_1.WaimaiStoreService,
            search_assist_service_1.SearchAssistService,
            campus_ad_service_1.CampusAdService,
            campus_locker_service_1.CampusLockerService,
            privacy_number_service_1.PrivacyNumberService,
            cloud_print_service_1.CloudPrintService,
            merchant_admin_service_1.MerchantAdminService,
            campus_notify_service_1.CampusNotifyService,
            third_party_delivery_service_1.ThirdPartyDeliveryService,
            payment_timeout_job_1.PaymentTimeoutJob,
            payment_timeout_admin_service_1.PaymentTimeoutAdminService,
            feishu_config_1.FeishuConfigService,
            feishu_client_1.FeishuClient,
            feishu_card_service_1.FeishuCardService,
            feishu_notify_service_1.FeishuNotifyService,
            feishu_command_service_1.FeishuCommandService,
            feishu_event_service_1.FeishuEventService,
            feishu_digest_service_1.FeishuDigestService,
        ],
        controllers: [feishu_controller_1.FeishuController],
        adminApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
                type CampusZone {
                    id: ID!
                    name: String!
                    fee: Int!
                    channelId: ID!
                }

                type CampusBuilding {
                    id: ID!
                    name: String!
                    detail: String
                    zoneId: ID!
                    channelId: ID!
                    lat: Float
                    lng: Float
                }

                input CampusBuildingPatchInput {
                    name: String
                    detail: String
                    lat: Float
                    lng: Float
                }

                type CampusFulfillmentConfig {
                    id: ID!
                    channelId: ID!
                    routesEnabled: [String!]!
                    riderCommissionRate: Int!
                    autoAssignMinutes: Int!
                    paused: Boolean!
                    autoRefundMinutes: Int!
                    inProgressSlaMinutes: Int!
                    compensationCouponTemplateId: String
                    merchantConfirmEnabled: Boolean!
                    merchantAutoOpenMinutes: Int!
                    freeShippingThreshold: Int
                    """配送费阶梯（P3-4）JSON：[{minAmount:分, fee:分}]，null=不启用"""
                    deliveryFeeTiers: String
                    timeoutCompensationEnabled: Boolean!
                    timeoutGraceMinutes: Int!
                    """超时赔付回扫窗口（小时，1-168），默认 24"""
                    timeoutCompensationWindowHours: Int!
                    timeoutCompensationCouponTemplateId: String
                    """接单班次校验：开启后骑手仅能在后台登记的排班时段内抢单"""
                    shiftCheckEnabled: Boolean!
                    """自动拉黑阈值：近 30 天顾客主动取消订单达到该次数自动加入黑名单（0=关闭）"""
                    blacklistAutoCancelCount: Int!
                }

                input CampusFulfillmentConfigInput {
                    routesEnabled: [String!]
                    riderCommissionRate: Int
                    autoAssignMinutes: Int
                    paused: Boolean
                    autoRefundMinutes: Int
                    inProgressSlaMinutes: Int
                    compensationCouponTemplateId: String
                    merchantConfirmEnabled: Boolean
                    merchantAutoOpenMinutes: Int
                    """配送费阶梯（P3-4）JSON：[{minAmount:分, fee:分}]，null=不启用"""
                    deliveryFeeTiers: String
                    timeoutCompensationEnabled: Boolean
                    timeoutGraceMinutes: Int
                    timeoutCompensationWindowHours: Int
                    timeoutCompensationCouponTemplateId: String
                    shiftCheckEnabled: Boolean
                    blacklistAutoCancelCount: Int
                }

                type DeliverySlot {
                    id: ID!
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int!
                    lockedCount: Int!
                    active: Boolean!
                    channelId: ID!
                }

                input DeliverySlotInput {
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int
                }

                input DeliverySlotUpdateInput {
                    startTime: String
                    endTime: String
                    capacity: Int
                    active: Boolean
                }

                type CampusSetRiderStatusResult {
                    status: String!
                }

                type MerchantBoardLine {
                    name: String!
                    quantity: Int!
                    price: Int!
                }

                type MerchantBoardOrder {
                    id: ID!
                    code: String!
                    createdAt: DateTime!
                    total: Int!
                    shipping: Int!
                    building: String!
                    zone: String!
                    slotText: String!
                    route: String!
                    riderName: String
                    note: String
                    printedAt: DateTime
                    provider: String
                    thirdPartyNo: String
                    handoverCode: String
                    lines: [MerchantBoardLine!]!
                }

                """营业时间自动切换（自动开门 / 自动打烊）：inMinutes=距切换分钟数，today=是否发生在今天"""
                type CampusBusinessTransition {
                    """open=到点自动开门，close=到点自动打烊"""
                    action: String!
                    """切换时刻 HH:mm"""
                    at: String!
                    inMinutes: Int!
                    today: Boolean!
                }

                type CampusMerchantBoard {
                    paused: Boolean!
                    """营业时段内且未临时休息（自动开关门生效依据）"""
                    openNow: Boolean!
                    """本店营业时间（空=全天营业）"""
                    businessHours: String
                    """下一次自动开门/打烊（null=全天营业）"""
                    nextTransition: CampusBusinessTransition
                    merchantConfirmEnabled: Boolean!
                    printMode: String!
                    """打印通道（P1-4）：local=前端 C-Lodop / feie / yilianyun"""
                    printProvider: String!
                    """云通道账号/设备/密钥是否已配齐"""
                    cloudPrintConfigured: Boolean!
                    storeName: String!
                    storePhone: String
                    pending: [MerchantBoardOrder!]!
                    cooking: [MerchantBoardOrder!]!
                    awaitingRider: [MerchantBoardOrder!]!
                    delivering: [MerchantBoardOrder!]!
                    pendingDispatch: [MerchantBoardOrder!]!
                    thirdParty: [MerchantBoardOrder!]!
                    ownedPool: [MerchantBoardOrder!]!
                    ownedDispatched: [MerchantBoardOrder!]!
                    merchantDelivering: [MerchantBoardOrder!]!
                    scheduled: [MerchantBoardOrder!]!
                    completedToday: Int!
                    completedTodayAmount: Int!
                }

                """KDS 出餐屏单行（含加料快照）"""
                type CampusKitchenLine {
                    name: String!
                    quantity: Int!
                    addons: [String!]!
                }

                """KDS 出餐票：pending=待接单，cooking=制作中；urgency=normal/warn/late"""
                type CampusKitchenTicket {
                    id: ID!
                    code: String!
                    stage: String!
                    createdAt: DateTime!
                    waitingMinutes: Int!
                    urgency: String!
                    zone: String!
                    building: String!
                    slotText: String!
                    note: String
                    printedAt: DateTime
                    total: Int!
                    lines: [CampusKitchenLine!]!
                }

                type CampusKitchenQueue {
                    tickets: [CampusKitchenTicket!]!
                    pendingCount: Int!
                    cookingCount: Int!
                    lateCount: Int!
                    warnMinutes: Int!
                    lateMinutes: Int!
                }

                """云打印结果：dryRun 保留给未接真实设备的联调场景"""
                type CampusPrintResult {
                    ok: Boolean!
                    provider: String!
                    dryRun: Boolean!
                    jobId: ID
                    error: String
                }

                """云打印任务留痕（排障/重打依据）"""
                type CampusPrintJob {
                    id: ID!
                    orderId: ID
                    orderCode: String
                    provider: String!
                    deviceSn: String
                    status: String!
                    triggerType: String!
                    copies: Int!
                    dryRun: Boolean!
                    errorMessage: String
                    durationMs: Int
                    createdAt: DateTime!
                }

                """商家自助经营：门店资料（营业状态按校园时区判定）"""
                type MerchantStoreProfile {
                    storeName: String!
                    businessHours: String
                    storeNotice: String
                    storePhone: String
                    paused: Boolean!
                    openNow: Boolean!
                    """下一次自动开门/打烊（null=全天营业）"""
                    nextTransition: CampusBusinessTransition
                }

                """经营数据分桶（分）：营业额=窗口内已送达订单实付；取消=窗口内取消单（全额退款口径）"""
                type CampusMerchantRevenueBucket {
                    orders: Int!
                    gross: Int!
                    avgTicket: Int!
                    cancelled: Int!
                    cancelledAmount: Int!
                }

                type CampusMerchantRevenueDay {
                    date: String!
                    orders: Int!
                    gross: Int!
                    cancelled: Int!
                    cancelledAmount: Int!
                }

                type CampusMerchantRevenue {
                    today: CampusMerchantRevenueBucket!
                    last7: CampusMerchantRevenueBucket!
                    days: [CampusMerchantRevenueDay!]!
                    """P3-2 导出用：近 30 日（含今日）逐日明细，口径与 days 一致"""
                    days30: [CampusMerchantRevenueDay!]!
                }

                type DispatchAlert {
                    orderId: ID!
                    orderCode: String!
                    type: String!
                    detail: String!
                    exceptionNote: String
                    exceptionPhotos: [String!]
                }

                type DispatchRider {
                    customerId: ID!
                    realName: String!
                    credit: Int!
                }

                type HandedException {
                    orderId: ID!
                    orderCode: String!
                    exceptionType: String
                    action: String!
                    compensation: Int
                    couponTemplateId: String
                    note: String
                    handledAt: String
                    handledBy: String!
                }

                type CampusDispatchBoard {
                    paused: Boolean!
                    alerts: [DispatchAlert!]!
                    hallOrders: [Order!]!
                    activeOrders: [Order!]!
                    ridersOnline: [DispatchRider!]!
                    handledOrders: [HandedException!]!
                }

                type CampusDispatchResult {
                    assigned: Boolean
                    backToHall: Boolean
                }
                type CampusHandleExceptionResult {
                    ok: Boolean
                    action: String
                }

                type CampusErrandProductResult {
                    variantId: ID!
                    sku: String!
                }

                type CampusEnsureProfileResult {
                    profileId: ID!
                    profileName: String!
                    linkedMethodCodes: [String!]!
                    missingMethodCodes: [String!]!
                    boundVariantCount: Int!
                }

                """第一段承运方（仅 R1: merchant|owned，R3: campus|owned|external）"""
                type CampusRouteCarrier {
                    route: String!
                    carrier: String!
                }

                input CampusRouteCarrierInput {
                    route: String!
                    carrier: String!
                }

                """校园交接点（仅 R1、R2 需要，同一路线可配多个，按收货楼栋取最近）"""
                type CampusHandoverPoint {
                    route: String!
                    name: String!
                    address: String
                    phone: String
                    lat: Float!
                    lng: Float!
                    """无收货坐标时的兜底默认点"""
                    isDefault: Boolean!
                }

                input CampusHandoverPointInput {
                    route: String!
                    name: String!
                    address: String
                    phone: String
                    lat: Float!
                    lng: Float!
                    """无收货坐标时的兜底默认点（每条路线只保留一个）"""
                    isDefault: Boolean
                }

                """外部快递门店编号（运营中心维护，不对外暴露给商户）"""
                type CampusProviderShopNo {
                    provider: String!
                    shopNo: String!
                }

                input CampusProviderShopNoInput {
                    provider: String!
                    shopNo: String!
                }

                type CampusStoreConfigWithChannel {
                    channelId: ID!
                    channelName: String!
                    channelToken: String!
                    routesEnabled: [String!]!
                    routeFirstLeg: [CampusRouteCarrier!]!
                    handoverPoints: [CampusHandoverPoint!]!
                    providerShopNo: [CampusProviderShopNo!]!
                    merchantAcceptMinutes: Int!
                    externalPushTimeoutMinutes: Int!
                    externalFallbackMinutes: Int!
                    storeLat: Float
                    storeLng: Float
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    errandBaseFee: Int
                    thirdPartyBaseFee: Int
                    freeShippingThreshold: Int
                    """配送费阶梯（P3-4）JSON：[{minAmount:分, fee:分}]，null=不启用"""
                    deliveryFeeTiers: String
                    dynamicPricing: String
                    notifyTemplateAccepted: String
                    notifyTemplateRiderAssigned: String
                    notifyTemplateCookingDone: String
                    notifyTemplateDelivered: String
                    notifyTemplateExceptionHandled: String
                    notifyTemplateOrderPlaced: String
                    notifyTemplatePaymentPending: String
                    notifyTemplateCancelled: String
                    notifyTemplateAfterSales: String
                    notifyTemplateAddressChanged: String
                    h5BaseUrl: String
                    printMode: String!
                    """打印通道（P1-4）：local / feie / yilianyun"""
                    printProvider: String!
                    printAccount: String
                    printDeviceSn: String
                    printDeviceKey: String
                    """打印联数（1-5）"""
                    printCopies: Int!
                    timeoutCompensationEnabled: Boolean!
                    timeoutGraceMinutes: Int!
                    """超时赔付回扫窗口（小时，1-168），默认 24"""
                    timeoutCompensationWindowHours: Int!
                    timeoutCompensationCouponTemplateId: String
                    """号码保护开关：开启后骑手/商家/客服侧不下发顾客真实手机号"""
                    privacyNumberEnabled: Boolean!
                    """隐私号服务商：mask / mock / aliyun / tencent"""
                    privacyNumberProvider: String!
                    privacyNumberTtlMinutes: Int!
                    privacyNumberPrefix: String
                    foodLicenseNo: String
                    foodLicenseImage: String
                    foodLicenseExpiry: String
                    foodSafetyGrade: String
                    foodSafetyCommitmentImage: String
                    kitchenLiveUrl: String
                    kitchenLiveEnabled: Boolean!
                    """打包费开关"""
                    packingFeeEnabled: Boolean!
                    """计费方式：perItem=按件累加 / perOrder=每单固定"""
                    packingFeeMode: String!
                    """打包费金额（分）：perItem=单件，perOrder=每单"""
                    packingFeeAmount: Int!
                    """单笔封顶（分，null=不封顶）"""
                    packingFeeCap: Int
                    """C 端展示名称（空=打包费）"""
                    packingFeeLabel: String
                    """小程序 AppID（wx + 16 位十六进制）"""
                    mpAppId: String
                    """服务类目（如「餐饮/外卖」）"""
                    mpCategory: String
                    """当前上架版本号（x.y.z）"""
                    mpVersion: String
                    """上架状态：draft / inReview / online / rejected / offline"""
                    mpListingStatus: String!
                    """用户隐私保护指引地址"""
                    mpPrivacyUrl: String
                    """审核备注 / 驳回原因"""
                    mpReviewNote: String
                    """上架前检查是否齐全（AppID/类目/版本/隐私指引/客服电话/食品许可证）"""
                    mpReady: Boolean!
                    """上架前检查缺项 key：appId / category / version / privacyUrl / contactPhone / licenseNo"""
                    mpMissing: [String!]!
                    """语音搜索服务商：mock（内置模拟）/ none（未开启）"""
                    voiceSearchProvider: String!
                    """拍照搜索服务商：mock（内置模拟）/ none（未开启）"""
                    imageSearchProvider: String!
                }

                """隐私联系方式（号码保护）：protected=false 时 display 即真实号"""
                type CampusPrivacyContact {
                    protected: Boolean!
                    display: String
                    callable: String
                    provider: String!
                    expiresAt: DateTime
                    note: String
                }

                input CampusStoreConfigInput {
                    routesEnabled: [String!]!
                    routeFirstLeg: [CampusRouteCarrierInput!]
                    handoverPoints: [CampusHandoverPointInput!]
                    providerShopNo: [CampusProviderShopNoInput!]
                    merchantAcceptMinutes: Int
                    externalPushTimeoutMinutes: Int
                    externalFallbackMinutes: Int
                    storeLat: Float
                    storeLng: Float
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    errandBaseFee: Int
                    thirdPartyBaseFee: Int
                    freeShippingThreshold: Int
                    """配送费阶梯（P3-4）JSON：[{minAmount:分, fee:分}]，null=不启用"""
                    deliveryFeeTiers: String
                    dynamicPricing: String
                    notifyTemplateAccepted: String
                    notifyTemplateRiderAssigned: String
                    notifyTemplateCookingDone: String
                    notifyTemplateDelivered: String
                    notifyTemplateExceptionHandled: String
                    notifyTemplateOrderPlaced: String
                    notifyTemplatePaymentPending: String
                    notifyTemplateCancelled: String
                    notifyTemplateAfterSales: String
                    notifyTemplateAddressChanged: String
                    h5BaseUrl: String
                    printMode: String
                    """打印通道：local（默认）/ feie / yilianyun；云通道须同时传账号/设备/密钥"""
                    printProvider: String
                    printAccount: String
                    printDeviceSn: String
                    printDeviceKey: String
                    printCopies: Int
                    timeoutCompensationEnabled: Boolean
                    timeoutGraceMinutes: Int
                    timeoutCompensationWindowHours: Int
                    timeoutCompensationCouponTemplateId: String
                    privacyNumberEnabled: Boolean
                    privacyNumberProvider: String
                    privacyNumberTtlMinutes: Int
                    privacyNumberPrefix: String
                    foodLicenseNo: String
                    foodLicenseImage: String
                    foodLicenseExpiry: String
                    foodSafetyGrade: String
                    foodSafetyCommitmentImage: String
                    kitchenLiveUrl: String
                    kitchenLiveEnabled: Boolean
                    packingFeeEnabled: Boolean
                    packingFeeMode: String
                    packingFeeAmount: Int
                    packingFeeCap: Int
                    packingFeeLabel: String
                    mpAppId: String
                    mpCategory: String
                    mpVersion: String
                    """上架状态：draft / inReview / online / rejected / offline"""
                    mpListingStatus: String
                    mpPrivacyUrl: String
                    mpReviewNote: String
                    """语音搜索服务商：mock / none（undefined=保留原值）"""
                    voiceSearchProvider: String
                    """拍照搜索服务商：mock / none（undefined=保留原值）"""
                    imageSearchProvider: String
                }

                type RiderWithdrawalRequest {
                    id: ID!
                    customerId: ID!
                    channelId: ID!
                    amount: Int!
                    channel: String!
                    account: String!
                    status: String!
                    remark: String
                    reviewedBy: String
                    reviewedAt: DateTime
                    payoutRef: String
                    payoutProof: String
                    failReason: String
                    createdAt: DateTime
                }

                type RiderApplicationList {
                    items: [Customer!]!
                    total: Int!
                }

                """骑手合规判定项（P2-5：健康证/保险/背调）"""
                type RiderComplianceItem {
                    key: String!
                    label: String!
                    """ok / expiring / expired / pending / missing / failed"""
                    status: String!
                    expiry: DateTime
                    detail: String
                }

                type RiderComplianceResult {
                    customerId: ID!
                    ok: Boolean!
                    blocked: Boolean!
                    pending: Boolean!
                    items: [RiderComplianceItem!]!
                }

                input RiderComplianceInput {
                    healthCertNo: String
                    healthCertImg: String
                    healthCertExpiry: DateTime
                    insuranceNo: String
                    insuranceExpiry: DateTime
                    """none / pending / passed / failed"""
                    backgroundCheck: String
                }

                type CampusSupportTicket {
                    id: ID!
                    customerId: ID!
                    customerName: String
                    customerPhone: String
                    orderCode: String
                    category: String!
                    content: String!
                    images: [String!]
                    status: String!
                    reply: String
                    repliedAt: DateTime
                    createdAt: DateTime!
                }

                type CampusSupportTicketList {
                    items: [CampusSupportTicket!]!
                    total: Int!
                }

                type CampusRiderAppeal {
                    id: ID!
                    riderCustomerId: ID!
                    riderName: String
                    riderPhone: String
                    orderId: ID
                    orderCode: String
                    reason: String!
                    images: [String!]
                    status: String!
                    creditDelta: Int!
                    reviewNote: String
                    reviewedAt: DateTime
                    createdAt: DateTime!
                }

                type CampusRiderAppealList {
                    items: [CampusRiderAppeal!]!
                    total: Int!
                }

                type CampusBlacklistEntry {
                    id: ID!
                    type: String!
                    customerId: ID
                    phone: String
                    reason: String
                    createdBy: String
                    active: Boolean!
                    createdAt: DateTime!
                }

                type CampusBlacklistList {
                    items: [CampusBlacklistEntry!]!
                    total: Int!
                }

                type CampusRemoveResult {
                    ok: Boolean!
                }

                type CampusBlacklistImportResult {
                    added: Int!
                    skipped: Int!
                    invalid: Int!
                }

                """在线客服会话（后台列表行）：带顾客姓名/手机号，免去二次查询"""
                type CampusChatConversation {
                    id: ID!
                    customerId: ID!
                    customerName: String
                    customerPhone: String
                    orderCode: String
                    subject: String
                    status: String!
                    lastMessage: String
                    lastMessageAt: DateTime
                    lastSenderType: String
                    unreadForCustomer: Int!
                    unreadForAdmin: Int!
                    closedAt: DateTime
                    createdAt: DateTime!
                }

                type CampusChatConversationList {
                    items: [CampusChatConversation!]!
                    total: Int!
                }

                """未读角标：conversationCount 待处理会话数，messageCount 未读消息总数"""
                type CampusChatUnread {
                    conversationCount: Int!
                    messageCount: Int!
                }

                type CampusChatMessage {
                    id: ID!
                    conversationId: ID!
                    senderType: String!
                    senderId: ID
                    content: String
                    images: [String!]
                    readAt: DateTime
                    createdAt: DateTime!
                }

                type CampusRiderShift {
                    id: ID!
                    riderCustomerId: ID!
                    realName: String
                    shiftDate: String!
                    startTime: String!
                    endTime: String!
                    note: String
                    onlineMinutes: Int
                    shiftMinutes: Int
                }

                type CampusRiderShiftList {
                    date: String!
                    items: [CampusRiderShift!]!
                }

                input CampusRiderShiftInput {
                    id: ID
                    riderCustomerId: ID!
                    shiftDate: String!
                    startTime: String!
                    endTime: String!
                    note: String
                }

                type CampusRiderOnlineStat {
                    riderCustomerId: ID!
                    realName: String!
                    onlineMinutes: Int!
                }

                type CampusRiderOnlineStatList {
                    date: String!
                    items: [CampusRiderOnlineStat!]!
                }

                type CampusRiderReviewRow {
                    id: ID!
                    riderCustomerId: ID!
                    orderId: ID!
                    rating: Int!
                    tags: [String!]
                    comment: String
                    createdAt: DateTime!
                }

                type CampusRiderRating {
                    riderCustomerId: ID!
                    avgRating: Float!
                    ratingCount: Int!
                }

                type CampusMerchantProduct {
                    productId: ID!
                    name: String!
                    soldOut: Boolean!
                    monthlySales: Int!
                    variantCount: Int!
                    """商品级打包费单价（分/件）；null=沿用店铺配置金额"""
                    packingFee: Int
                    """加料组配置 JSON 字符串（AddonGroupConfig[]）；null=无加料"""
                    addonGroups: String
                    """套餐内容 JSON 字符串（ComboConfig）；null=非套餐商品"""
                    combo: String
                }

                type CampusMerchantProductList {
                    items: [CampusMerchantProduct!]!
                    total: Int!
                }

                type CampusMerchantSoldOutResult {
                    ok: Boolean!
                    soldOut: Boolean!
                }

                """全店批量沽清结果：count 为本次实际影响的本渠道商品数"""
                type CampusMerchantSoldOutBatchResult {
                    ok: Boolean!
                    soldOut: Boolean!
                    count: Int!
                }

                """沽清次日自动恢复：enabled 为店铺开关，pending 为当前登记的待恢复件数"""
                type CampusSoldOutAutoRestore {
                    enabled: Boolean!
                    pending: Int!
                }

                type CampusMerchantPackingFeeResult {
                    ok: Boolean!
                    """保存后的商品级打包费（分/件）；null=沿用店铺配置"""
                    packingFee: Int
                }

                """商品加料组保存结果：addonGroups 为清洗后的 JSON 字符串，null=已清除"""
                type CampusMerchantAddonResult {
                    ok: Boolean!
                    addonGroups: String
                }

                """商品套餐保存结果：combo 为清洗后的 JSON 字符串，null=已清除"""
                type CampusMerchantComboResult {
                    ok: Boolean!
                    combo: String
                }

                type CampusRiderEarningRow {
                    id: ID!
                    orderId: ID!
                    orderCode: String
                    riderCustomerId: ID!
                    riderName: String!
                    """分成金额（分，已含小费折算）"""
                    amount: Int!
                    """其中小费（分，仅展示，不额外叠加）"""
                    tip: Int!
                    """credited / pending / crediting"""
                    status: String!
                    createdAt: DateTime!
                }

                type CampusRiderEarningList {
                    items: [CampusRiderEarningRow!]!
                    total: Int!
                    """筛选条件下全量分成合计（分）"""
                    sumAmount: Int!
                    """筛选条件下全量小费合计（分）"""
                    sumTip: Int!
                }

                type CampusRiderTrackPoint {
                    id: ID!
                    orderId: ID!
                    orderCode: String
                    riderCustomerId: ID!
                    lat: Float!
                    lng: Float!
                    reportedAt: DateTime!
                }

                type CampusRiderTrack {
                    orderId: ID
                    orderCode: String
                    riderCustomerId: ID
                    riderName: String
                    points: [CampusRiderTrackPoint!]!
                    """相邻点位球面直线距离累计（米）"""
                    distanceMeters: Int!
                    """是否因单次上限 5000 点被截断"""
                    truncated: Boolean!
                }

                """广告投放单（P2-3）：商家自助下单 → 模拟支付 → 平台审核 → 按日期投放"""
                type CampusAdCampaign {
                    id: ID!
                    channelId: ID!
                    """广告位：homeBanner（首页横幅）/ shopTop（店铺页顶部）"""
                    slot: String!
                    title: String!
                    imageUrl: String
                    linkUrl: String
                    """投放开始日（YYYY-MM-DD，含当日）"""
                    startDate: String!
                    """投放结束日（YYYY-MM-DD，含当日）"""
                    endDate: String!
                    days: Int!
                    unitPriceFen: Int!
                    totalFen: Int!
                    """pendingPay / pendingReview / running / rejected / cancelled / finished（已结束按日期实时判定）"""
                    status: String!
                    """当前是否在展示窗口内"""
                    live: Boolean!
                    payRef: String
                    paidAt: DateTime
                    reviewNote: String
                    reviewedBy: String
                    reviewedAt: DateTime
                    createdAt: DateTime
                }

                type CampusAdSlot {
                    code: String!
                    name: String!
                    """单日单价（分）"""
                    unitPriceFen: Int!
                }

                """智能取餐柜站点（P2-4）：后端只落站点与格口规模，柜机 SDK 待接"""
                type CampusLockerStation {
                    id: ID!
                    channelId: ID!
                    name: String!
                    """柜机位置（如「东区 3 号楼一层大厅」）"""
                    location: String!
                    """服务商编码：self=自建"""
                    provider: String!
                    providerName: String!
                    totalCells: Int!
                    """可用格口（运营手工维护，本轮不接实时库存）"""
                    availableCells: Int!
                    openHours: String
                    pickupGuide: String
                    enabled: Boolean!
                    sort: Int!
                    createdBy: String
                    createdAt: DateTime
                }

                input CampusLockerStationInput {
                    name: String
                    location: String
                    provider: String
                    totalCells: Int
                    availableCells: Int
                    openHours: String
                    pickupGuide: String
                    enabled: Boolean
                    sort: Int
                }

                type CampusUnmannedProvider {
                    code: String!
                    name: String!
                    needsEndpoint: Boolean!
                    needsKey: Boolean!
                }

                """无人配送通道（P2-4 接口占位）：mock=模拟受理，真实厂商需 endpoint + key"""
                type CampusUnmannedChannel {
                    enabled: Boolean!
                    provider: String!
                    providerName: String!
                    providers: [CampusUnmannedProvider!]!
                    endpoint: String
                    """密钥是否已配置（不返回明文）"""
                    keyConfigured: Boolean!
                    needsEndpoint: Boolean!
                    needsKey: Boolean!
                }

                input CampusUnmannedChannelInput {
                    enabled: Boolean
                    provider: String
                    endpoint: String
                    key: String
                }

                type CampusUnmannedDeliveryResult {
                    ok: Boolean!
                    provider: String!
                    providerName: String!
                    """disabled / unconfigured / rejected / accepted"""
                    status: String!
                    requestNo: String
                    message: String!
                }

                extend type Query {
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusConfig: CampusFulfillmentConfig!
                    campusSlots: [DeliverySlot!]!
                    riderApplications(status: String!, skip: Int, take: Int): RiderApplicationList!
                    campusDispatchBoard: CampusDispatchBoard!
                    campusStoreConfigs: [CampusStoreConfigWithChannel!]!
                    """广告位报价（分/天）"""
                    campusAdSlots: [CampusAdSlot!]!
                    """商家侧：本渠道广告投放单"""
                    campusMerchantAds: [CampusAdCampaign!]!
                    """平台侧：按渠道/状态查投放单"""
                    campusAdCampaigns(status: String, channelId: ID): [CampusAdCampaign!]!
                    """智能取餐柜（P2-4）：本渠道站点（含停用）"""
                    campusLockerStations: [CampusLockerStation!]!
                    """无人配送通道（P2-4 接口占位）配置"""
                    campusUnmannedChannel: CampusUnmannedChannel!
                    campusMerchantBoard: CampusMerchantBoard!
                    """商家自助经营：门店资料（营业时间/公告/电话/营业状态）"""
                    campusMerchantStoreProfile: MerchantStoreProfile!
                    """商家自助经营数据：今日/近 7 日单量、营业额、客单价、取消退款"""
                    campusMerchantRevenue: CampusMerchantRevenue!
                    """商家侧顾客联系方式（号码保护）：开启后仅返回脱敏/虚拟号"""
                    campusMerchantCustomerContact(orderId: ID!): CampusPrivacyContact!
                    riderWithdrawals(status: String, skip: Int, take: Int): [RiderWithdrawalRequest!]!
                    campusDeliveryStats(range: String): CampusDeliveryStats!
                    """销售侧经营 BI（P4-1）：今日/7日/30日"""
                    campusSalesStats(range: String, from: String, to: String): CampusSalesStats!
                    campusAddressChanges(status: String, orderId: ID, skip: Int, take: Int): [CampusAddressChangeRow!]!
                    campusAddressChangeStats: CampusAddressChangeStats!
                    campusAdminQuoteAddressChange(orderId: ID!, zoneId: ID!): CampusAddressChangeQuote!
                    campusDynamicPricingPreview: CampusDynamicPricingPreview!
                    campusSupportTickets(status: String, skip: Int, take: Int): CampusSupportTicketList!
                    campusChatConversations(status: String, unreadOnly: Boolean, skip: Int, take: Int): CampusChatConversationList!
                    campusChatUnread: CampusChatUnread!
                    campusAdminChatMessages(conversationId: ID!, afterId: ID, take: Int): [CampusChatMessage!]!
                    campusRiderAppeals(status: String, skip: Int, take: Int): CampusRiderAppealList!
                    campusBlacklist(skip: Int, take: Int): CampusBlacklistList!
                    campusRiderShifts(date: String!): CampusRiderShiftList!
                    campusRiderOnlineStats(date: String): CampusRiderOnlineStatList!
                    campusRiderReviews(riderCustomerId: ID, skip: Int, take: Int): [CampusRiderReviewRow!]!
                    campusRiderRating(riderCustomerId: ID!): CampusRiderRating!
                    campusRiderEarnings(from: String, to: String, riderCustomerId: ID, status: String, orderCode: String, skip: Int, take: Int): CampusRiderEarningList!
                    campusOrderRiderTrack(orderId: ID, orderCode: String): CampusRiderTrack!
                    campusRiderTrack(riderCustomerId: ID!, from: String!, to: String!): CampusRiderTrack!
                    campusMerchantProducts(search: String, skip: Int, take: Int): CampusMerchantProductList!
                    """KDS 出餐屏（P1-4）：待接单/备餐中队列"""
                    campusMerchantKitchenQueue: CampusKitchenQueue!
                    """最近云打印任务（P1-4）"""
                    campusMerchantPrintJobs(limit: Int): [CampusPrintJob!]!
                    """沽清次日自动恢复（§66）：开关与待恢复件数"""
                    campusMerchantSoldOutAutoRestore: CampusSoldOutAutoRestore!
                }

                type CampusDeliveryStatsKpi {
                    totalOrders: Int!
                    onTimeRate: Float!
                    avgDeliveryMinutes: Float!
                    timeoutCompensated: Int!
                }

                type CampusDeliveryDailyPoint {
                    date: String!
                    orders: Int!
                    onTimeRate: Float!
                }

                type CampusDeliveryStage {
                    key: String!
                    label: String!
                    avgMinutes: Float!
                }

                type CampusDeliveryAttribution {
                    merchant: Int!
                    rider: Int!
                    platform: Int!
                }

                type CampusDeliveryStoreLine {
                    channelId: ID!
                    channelName: String!
                    orders: Int!
                    onTimeRate: Float!
                }

                type CampusDeliveryStats {
                    range: String!
                    windowStart: DateTime!
                    kpis: CampusDeliveryStatsKpi!
                    dailyTrend: [CampusDeliveryDailyPoint!]!
                    stages: [CampusDeliveryStage!]!
                    attribution: CampusDeliveryAttribution!
                    storeComparison: [CampusDeliveryStoreLine!]!
                }

                type CampusSalesKpi {
                    orders: Int!
                    gmvFen: Float!
                    aovFen: Float!
                    customers: Int!
                    newCustomers: Int!
                    repurchaseRate: Float!
                }

                type CampusSalesCompare {
                    ordersPct: Float!
                    gmvPct: Float!
                    aovPct: Float!
                    repurchaseRatePct: Float!
                }

                type CampusSalesHourPoint {
                    hour: Int!
                    orders: Int!
                    gmvFen: Float!
                }

                type CampusSalesDayPoint {
                    date: String!
                    orders: Int!
                    gmvFen: Float!
                }

                type CampusSalesProduct {
                    productId: ID!
                    name: String!
                    quantity: Int!
                    gmvFen: Float!
                    """star 明星 / traffic 引流 / premium 利润 / slow 滞销"""
                    quadrant: String!
                    """所属分类（商品结构导出按分类筛选用）"""
                    categories: [CampusSalesProductCategory!]!
                }

                type CampusSalesProductCategory {
                    id: ID!
                    name: String!
                }

                type CampusSalesCohorts {
                    once: Int!
                    twiceToFour: Int!
                    loyal: Int!
                }

                type CampusSalesStats {
                    range: String!
                    windowStart: DateTime!
                    kpis: CampusSalesKpi!
                    prev: CampusSalesKpi!
                    compare: CampusSalesCompare!
                    hourlyHeat: [CampusSalesHourPoint!]!
                    dailyTrend: [CampusSalesDayPoint!]!
                    products: [CampusSalesProduct!]!
                    cohorts: CampusSalesCohorts!
                    medianQuantity: Float!
                    medianGmvFen: Float!
                }

                type CampusAddressChangeRow {
                    id: ID!
                    orderId: ID!
                    orderCode: String!
                    customerId: ID
                    fromZone: String!
                    fromBuilding: String!
                    fromDetail: String
                    toZone: String!
                    toBuilding: String!
                    toDetail: String
                    oldFee: Int!
                    newFee: Int!
                    diff: Int!
                    status: String!
                    settledAt: DateTime
                    settleAction: String
                    """结清凭证：补收收款方式/流水号，或退款说明"""
                    settleNote: String
                    """实际退款单 id（财务对账）"""
                    refundId: ID
                    source: String
                    reason: String
                    changedBy: ID
                    createdAt: DateTime!
                }

                """改址差额试算（不落台账）"""
                type CampusAddressChangeQuote {
                    oldFee: Int!
                    newFee: Int!
                    diff: Int!
                    zoneId: ID!
                    zoneName: String!
                    buildings: [CampusBuilding!]!
                }

                type CampusPricingBreakdownItem {
                    key: String!
                    label: String!
                    fee: Int!
                }

                type CampusDynamicPricingZoneQuote {
                    zoneId: ID!
                    zoneName: String!
                    baseFee: Int!
                    price: Int!
                    addFee: Int!
                    breakdown: [CampusPricingBreakdownItem!]!
                }

                type CampusDynamicPricingSupply {
                    backlogThreshold: Int!
                    riderThreshold: Int
                    addFee: Int!
                }

                type CampusDynamicPricingPeakWindow {
                    label: String
                    start: String!
                    end: String!
                    addFee: Int!
                }

                type CampusDynamicPricingBaseQuote {
                    key: String!
                    configured: Boolean!
                    baseFee: Int!
                    price: Int!
                    addFee: Int!
                    breakdown: [CampusPricingBreakdownItem!]!
                }

                """动态计价试算预览：当前供需 + 各分区加价拆解"""
                type CampusDynamicPricingPreview {
                    at: DateTime!
                    enabled: Boolean!
                    backlog: Int!
                    onlineRiders: Int!
                    manualMultiplier: Float!
                    maxAddFee: Int!
                    supply: CampusDynamicPricingSupply
                    peakWindows: [CampusDynamicPricingPeakWindow!]!
                    zones: [CampusDynamicPricingZoneQuote!]!
                    """R5 跑腿起步价口径（未配置按默认 2 元）"""
                    errand: CampusDynamicPricingBaseQuote!
                    """R2 第三方到校基价口径（未配置返回 null，沿用店铺普通快递运费）"""
                    thirdParty: CampusDynamicPricingBaseQuote
                }

                type CampusAddressChangeStats {
                    total: Int!
                    pendingCount: Int!
                    pendingCollect: Int!
                    pendingRefund: Int!
                }

                type CampusAddressChangeResult {
                    diff: Int!
                    oldFee: Int!
                    newFee: Int!
                    fromZone: String!
                    toZone: String!
                    recordId: ID!
                }

                extend type Mutation {
                    campusCreateZone(name: String!, fee: Int!): CampusZone!
                    """分区改名/改运费（渠道隔离）"""
                    campusUpdateZone(id: ID!, name: String, fee: Int): CampusZone!
                    campusCreateBuilding(name: String!, zoneId: ID!, detail: String, lat: Float, lng: Float): CampusBuilding!
                    campusUpdateBuilding(id: ID!, input: CampusBuildingPatchInput!): CampusBuilding!
                    """删除宿舍楼（有订单引用时拒绝）"""
                    campusDeleteBuilding(id: ID!): Boolean!
                    campusUpdateConfig(input: CampusFulfillmentConfigInput!): CampusFulfillmentConfig!
                    campusCreateSlot(input: DeliverySlotInput!): DeliverySlot!
                    campusUpdateSlot(id: ID!, input: DeliverySlotUpdateInput!): DeliverySlot!
                    campusSetRiderStatus(customerId: ID!, status: String!): CampusSetRiderStatusResult!
                    """骑手合规登记（P2-5：健康证/保险/背调），返回最新合规判定"""
                    campusUpdateRiderCompliance(customerId: ID!, input: RiderComplianceInput!): RiderComplianceResult!
                    campusAssignOrder(orderId: ID!, riderCustomerId: ID!): CampusDispatchResult!
                    campusBackToHall(orderId: ID!, note: String): CampusDispatchResult!
                    campusHandleException(orderId: ID!, action: String!, amount: Int, couponTemplateId: ID, note: String): CampusHandleExceptionResult!
                    campusEnsureErrandProducts: CampusErrandProductResult!
                    campusUpdateStoreConfig(channelId: ID!, input: CampusStoreConfigInput!): CampusStoreConfigWithChannel!
                    """商家下单广告（按天计费，下单即固化单价与总价，状态 pendingPay）"""
                    campusMerchantCreateAd(slot: String!, title: String!, startDate: String!, endDate: String!, imageUrl: String, linkUrl: String): CampusAdCampaign!
                    """商家支付广告费（模拟支付，转待审核；重复调用幂等）"""
                    campusMerchantPayAd(id: ID!): CampusAdCampaign!
                    """商家取消广告投放（仅未支付/待审核可取消）"""
                    campusMerchantCancelAd(id: ID!): CampusAdCampaign!
                    """平台审核广告：通过转投放中，驳回须填原因"""
                    campusReviewAd(id: ID!, approve: Boolean!, note: String): CampusAdCampaign!
                    """智能取餐柜（P2-4）：新增站点"""
                    campusCreateLockerStation(input: CampusLockerStationInput!): CampusLockerStation!
                    """智能取餐柜：编辑站点（只改传入字段）"""
                    campusUpdateLockerStation(id: ID!, input: CampusLockerStationInput!): CampusLockerStation!
                    """智能取餐柜：删除站点"""
                    campusDeleteLockerStation(id: ID!): Boolean!
                    """无人配送通道：保存配置（endpoint/key 传空串 = 清空）"""
                    campusUpdateUnmannedChannel(input: CampusUnmannedChannelInput!): CampusUnmannedChannel!
                    """无人配送调用占位：配置校验通过后模拟受理，返回模拟单号"""
                    campusRequestUnmannedDelivery(orderId: ID!): CampusUnmannedDeliveryResult!
                    campusSettleAddressChange(id: ID!, action: String!, note: String): CampusAddressChangeRow!
                    """运营代客改址：取货后也可代改，必须填写原因"""
                    campusAdminChangeDeliveryAddress(orderId: ID!, zoneId: ID!, buildingId: ID!, detail: String, reason: String!): CampusAddressChangeResult!
                    campusEnsureDefaultShippingProfile(channelId: ID!): CampusEnsureProfileResult!
                    """设置商品级打包费（分/件）；传 null 清除，回落到店铺配置金额"""
                    campusMerchantSetProductPackingFee(productId: ID!, packingFee: Int): CampusMerchantPackingFeeResult!
                    """设置商品加料组（P1-2）：groups 为 AddonGroupConfig 的 JSON 字符串数组，空数组清除"""
                    campusMerchantSetProductAddonGroups(productId: ID!, groups: [String!]!): CampusMerchantAddonResult!
                    """设置商品套餐内容（P1-2）：combo 为 ComboConfig 的 JSON 字符串，null 清除"""
                    campusMerchantSetProductCombo(productId: ID!, combo: String): CampusMerchantComboResult!
                    campusMerchantAcceptOrder(orderId: ID!): CampusMerchantOpResult!
                    campusMerchantCookingDone(orderId: ID!): CampusMerchantOpResult!
                    campusMerchantRejectOrder(orderId: ID!, reason: String!): CampusMerchantOpResult!
                    campusMerchantSetPaused(paused: Boolean!): CampusMerchantOpResult!
                    """商家自助修改门店资料：营业时间（Channel 自定义字段）/公告/电话，仅本渠道"""
                    campusMerchantUpdateStore(businessHours: String, storeNotice: String, storePhone: String): MerchantStoreProfile!
                    campusMerchantMarkPrinted(orderId: ID!): CampusMerchantOpResult!
                    """云打印一张小票（P1-4）：后端签名直连服务商，成功回写打印时间"""
                    campusMerchantCloudPrint(orderId: ID!): CampusPrintResult!
                    """云打印连通性测试（不占用订单）"""
                    campusMerchantCloudPrintTest: CampusPrintResult!
                    campusMerchantDispatchExternal(orderId: ID!, provider: String!): CampusExternalDelivery!
                    campusMerchantCancelExternal(orderId: ID!, reason: String): CampusExternalCancelResult!
                    """运营中心推送/重推外部快递"""
                    campusAdminDispatchExternal(orderId: ID!, provider: String!): CampusExternalDelivery!
                    """运营中心取消外部快递"""
                    campusAdminCancelExternal(orderId: ID!, reason: String): CampusExternalCancelResult!
                    campusMerchantAcceptOwned(orderId: ID!): CampusMerchantOpResult!
                    campusMerchantMarkHandoverArrived(orderId: ID!): CampusFirstLegResult!
                    campusMerchantMarkOwnedArrived(orderId: ID!): CampusFirstLegResult!
                    approveRiderWithdraw(id: ID!, remark: String, payoutRef: String, payoutProof: String): RiderWithdrawalRequest!
                    rejectRiderWithdraw(id: ID!, remark: String): RiderWithdrawalRequest!
                    """打款失败回退：PAID → FAILED 并退回骑手余额"""
                    campusMarkWithdrawFailed(id: ID!, reason: String!): RiderWithdrawalRequest!
                    campusReplySupportTicket(id: ID!, reply: String, status: String): CampusSupportTicket!
                    campusReplyChat(conversationId: ID!, content: String, images: [String!]): CampusChatMessage!
                    campusCloseChatConversation(conversationId: ID!): CampusChatConversation!
                    campusReviewRiderAppeal(id: ID!, approve: Boolean!, creditDelta: Int, note: String): CampusRiderAppeal!
                    campusAddBlacklist(type: String!, value: String!, reason: String): CampusBlacklistEntry!
                    campusImportBlacklist(type: String!, values: [String!]!, reason: String): CampusBlacklistImportResult!
                    campusRemoveBlacklist(id: ID!): CampusRemoveResult!
                    campusSaveRiderShift(input: CampusRiderShiftInput!): CampusRiderShift!
                    campusDeleteRiderShift(id: ID!): CampusRemoveResult!
                    campusMerchantSetProductSoldOut(productId: ID!, soldOut: Boolean!): CampusMerchantSoldOutResult!
                    campusMerchantSetAllProductsSoldOut(soldOut: Boolean!): CampusMerchantSoldOutBatchResult!
                    """沽清次日自动恢复（§66）：开关；开启后每日 04:00 把全店沽清批次恢复在售"""
                    campusMerchantSetSoldOutAutoRestore(enabled: Boolean!): CampusSoldOutAutoRestore!
                }

                type CampusMerchantOpResult {
                    ok: Boolean!
                }

                """外部快递推送结果；already=true 表示重复推送（幂等）"""
                type CampusExternalDelivery {
                    ok: Boolean!
                    provider: String
                    thirdPartyNo: String
                    already: Boolean
                }

                type CampusExternalCancelResult {
                    ok: Boolean!
                    reason: String
                    skipped: Boolean
                }

                """第一段完成结果；done=true 表示订单已直送完成（R3）"""
                type CampusFirstLegResult {
                    ok: Boolean!
                    done: Boolean!
                }

                type PaymentTimeoutTask {
                    id: ID!
                    orderId: ID!
                    type: String!
                    status: String!
                    dueAt: DateTime!
                    retryCount: Int!
                    lastError: String
                }

                type PaymentTimeoutTaskRow {
                    id: ID!
                    orderId: ID!
                    channelId: ID!
                    orderCode: String
                    orderState: String
                    type: String!
                    status: String!
                    dueAt: DateTime!
                    retryCount: Int!
                    lastError: String
                }

                type PaymentTimeoutTaskList {
                    items: [PaymentTimeoutTaskRow!]!
                    total: Int!
                }

                type PaymentTimeoutStats {
                    todayRemind: Int!
                    todayCancel: Int!
                    totalFailed: Int!
                    pendingOverdue: Int!
                }

                extend type Query {
                    paymentTimeoutTasks(status: String, type: String, from: DateTime, to: DateTime, skip: Int, take: Int): PaymentTimeoutTaskList!
                    paymentTimeoutStats: PaymentTimeoutStats!
                }

                extend type Mutation {
                    executePaymentTimeoutTask(id: ID!): PaymentTimeoutTask!
                    resendPaymentTimeoutRemind(taskId: ID!): Boolean!
                    runPaymentTimeoutCompensation: Int!
                }

                """P4-4 系统监控：单事件计数（Top 事件榜）"""
                type CampusEventCount {
                    name: String!
                    count: Int!
                }

                """P4-4 近 7 日趋势点（按校园自然日）"""
                type CampusTrackDayPoint {
                    date: String!
                    events: Int!
                    errors: Int!
                }

                type CampusTrackEventStats {
                    todayEvents: Int!
                    totalEvents: Int!
                    todayErrors: Int!
                    totalErrors: Int!
                    """今日去重顾客数（游客不计）"""
                    affectedUsers: Int!
                    trend: [CampusTrackDayPoint!]!
                    topEvents: [CampusEventCount!]!
                }

                type CampusTrackEvent implements Node {
                    id: ID!
                    eventName: String!
                    page: String
                    sessionId: String
                    customerId: ID
                    """事件属性原始 JSON"""
                    props: String
                    createdAt: DateTime!
                }

                type CampusTrackEventList implements PaginatedList {
                    items: [CampusTrackEvent!]!
                    totalItems: Int!
                }

                type CampusErrorReport implements Node {
                    id: ID!
                    """c-end / admin"""
                    source: String!
                    """error / warn"""
                    level: String!
                    message: String!
                    stack: String
                    page: String
                    url: String
                    customerId: ID
                    createdAt: DateTime!
                }

                type CampusErrorReportList implements PaginatedList {
                    items: [CampusErrorReport!]!
                    totalItems: Int!
                }

                extend type Query {
                    campusTrackEventStats: CampusTrackEventStats!
                    campusTrackEventList(eventName: String, skip: Int, take: Int): CampusTrackEventList!
                    campusErrorReportList(level: String, skip: Int, take: Int): CampusErrorReportList!
                }
            `;
            },
            resolvers: [campus_config_admin_resolver_1.CampusConfigAdminResolver, rider_admin_resolver_1.RiderAdminResolver, rider_ledger_admin_resolver_1.RiderLedgerAdminResolver, dispatch_admin_resolver_1.DispatchAdminResolver, merchant_admin_resolver_1.MerchantAdminResolver, payment_timeout_admin_resolver_1.PaymentTimeoutAdminResolver, delivery_stats_resolver_1.DeliveryStatsResolver, sales_stats_resolver_1.SalesStatsResolver, address_change_resolver_1.AddressChangeAdminResolver, support_admin_resolver_1.SupportAdminResolver, chat_admin_resolver_1.ChatAdminResolver, campus_ad_resolver_1.CampusAdAdminResolver, campus_locker_resolver_1.CampusLockerAdminResolver, telemetry_resolver_1.TelemetryAdminResolver],
        },
        shopApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                // shop 与 admin 是两个独立 schema，输出类型需各自定义
                return gql `
                """结算页分区动态加价拆解（时段/供需/手动倍率）"""
                type CampusPricingBreakdownItem {
                    key: String!
                    label: String!
                    fee: Int!
                }

                type CampusZone {
                    id: ID!
                    name: String!
                    """分区基价（分）"""
                    fee: Int!
                    """实时应付（分，= 基价 + 动态加价，单笔封顶）"""
                    price: Int!
                    """动态加价金额（分）"""
                    addFee: Int!
                    breakdown: [CampusPricingBreakdownItem!]!
                    channelId: ID!
                }

                type CampusBuilding {
                    id: ID!
                    name: String!
                    detail: String
                    zoneId: ID!
                    channelId: ID!
                }

                type RiderProfile {
                    customerId: ID!
                    riderStatus: String
                    riderRealName: String
                    riderStudentNo: String
                    riderCampus: String
                    riderCredit: Int
                    """P2-5 合规明细（骑手端到期提醒）"""
                    compliance: RiderCompliance
                    riderHealthCertExpiry: DateTime
                    riderInsuranceExpiry: DateTime
                }

                """骑手合规判定项（P2-5）"""
                type RiderComplianceItem {
                    key: String!
                    label: String!
                    """ok / expiring / expired / pending / missing / failed"""
                    status: String!
                    expiry: DateTime
                    detail: String
                }

                type RiderCompliance {
                    ok: Boolean!
                    blocked: Boolean!
                    pending: Boolean!
                    items: [RiderComplianceItem!]!
                }

                type RiderApplyResult {
                    status: String!
                }

                type DeliverySlot {
                    id: ID!
                    slotDate: String!
                    startTime: String!
                    endTime: String!
                    zoneId: ID
                    capacity: Int!
                    lockedCount: Int!
                    active: Boolean!
                    channelId: ID!
                }

                type RiderEarning {
                    id: ID!
                    orderId: ID!
                    riderCustomerId: ID!
                    amount: Int!
                    tip: Int!
                    status: String!
                    createdAt: DateTime
                    channelId: ID!
                }

                type CampusRiderOnlineResult {
                    online: Boolean!
                }

                type CampusCapacityCheck {
                    paused: Boolean!
                    ridersOnline: Int!
                }

                type CampusRejectResult {
                    backToHall: Boolean!
                }

                input CampusErrandInput {
                    kind: String!
                    fromText: String!
                    toText: String!
                    tip: Int!
                    buildingId: ID
                    campusZone: String
                    errandFrom: String
                    note: String
                }

                type CampusErrandInfoResult {
                    orderId: ID!
                }

                type CampusErrandVariantResult {
                    variantId: ID!
                    sku: String!
                    errandBaseFee: Int!
                }

                type CampusArrivedResult {
                    leg1Status: String!
                }

                type WaimaiStore {
                    channelId: ID!
                    channelToken: String!
                    name: String!
                    logo: String
                    tags: [String!]!
                    monthlySales: Int!
                    promoText: String
                    paused: Boolean!
                    routesEnabled: [String!]!
                    deliveryMinutes: Int
                    minOrderAmount: Int
                    deliveryFee: Int
                    storeAddress: String
                    storePhone: String
                    storeNotice: String
                    businessHours: String
                    """当前是否可下单（营业时段内且未暂停营业，服务端按 UTC+8 判定）"""
                    openNow: Boolean!
                    errandBaseFee: Int
                    freeShippingThreshold: Int
                    """配送费阶梯（P3-4）JSON：[{minAmount:分, fee:分}]，null=不启用"""
                    deliveryFeeTiers: String
                    foodLicenseNo: String
                    foodLicenseImage: String
                    foodLicenseExpiry: String
                    foodSafetyGrade: String
                    foodSafetyCommitmentImage: String
                    kitchenLiveUrl: String
                    kitchenLiveEnabled: Boolean!
                    """打包费开关（C 端结算页预估用；最终金额以结算时落账为准）"""
                    packingFeeEnabled: Boolean!
                    """计费方式：perItem=按件累加 / perOrder=每单固定"""
                    packingFeeMode: String!
                    """打包费金额（分）：perItem=单件，perOrder=每单"""
                    packingFeeAmount: Int!
                    """单笔封顶（分，null=不封顶）"""
                    packingFeeCap: Int
                    """C 端展示名称（空=打包费）"""
                    packingFeeLabel: String
                }

                """隐私联系方式（号码保护）：protected=false 时 display 即真实号"""
                type CampusPrivacyContact {
                    protected: Boolean!
                    display: String
                    callable: String
                    provider: String!
                    expiresAt: DateTime
                    note: String
                }

                type CampusOrderRider {
                    realName: String!
                    credit: Int!
                    phone: String
                    location: CampusRiderLocation
                    destination: CampusRiderDestination
                    distanceMeters: Int
                    etaMinutes: Int
                    deliveryStatus: String
                }

                type CampusRiderLocation {
                    lat: Float!
                    lng: Float!
                }

                """配送目标楼栋（有坐标才返回）"""
                type CampusRiderDestination {
                    name: String!
                    detail: String
                    lat: Float!
                    lng: Float!
                }

                """C 端订单配送卡：承运方、外部快递单号与骑手、校园交接点"""
                type CampusOrderDelivery {
                    deliveryPlan: String
                    handoverMode: String
                    provider: String
                    thirdPartyNo: String
                    state: String
                    courierName: String
                    courierPhone: String
                    handoverPointName: String
                    handoverPointAddress: String
                    handoverAt: DateTime
                }

                extend type Order {
                    campusOrderDelivery: CampusOrderDelivery
                }

                type CampusR2Relay {
                    orderId: ID!
                    orderCode: String!
                    state: String!
                    hallStatus: String
                    deliveryStatus: String
                    errandTo: String
                    tip: Int!
                    totalWithTax: Int!
                }

                type RiderWallet {
                    available: Int!
                    frozen: Int!
                    totalEarned: Int!
                }

                type RiderWithdrawalRequest {
                    id: ID!
                    customerId: ID!
                    channelId: ID!
                    amount: Int!
                    channel: String!
                    account: String!
                    status: String!
                    remark: String
                    reviewedBy: String
                    reviewedAt: DateTime
                    payoutRef: String
                    payoutProof: String
                    failReason: String
                    createdAt: DateTime
                }

                type RiderBalanceTx {
                    id: ID!
                    createdAt: DateTime
                    type: String!
                    amount: Int!
                    balanceAfter: Int!
                    remark: String
                }

                type CampusHallOrderCustomFields {
                    hallStatus: String
                    hallEnteredAt: DateTime
                    tip: Int
                    fulfillmentRoute: String
                    campusZone: String
                    buildingId: String
                    deliverySlotText: String
                    routeGroupId: String
                }

                type CampusHallOrder {
                    id: ID!
                    code: String!
                    total: Int!
                    shipping: Int!
                    createdAt: DateTime!
                    channelId: ID!
                    channelToken: String!
                    channelName: String!
                    customFields: CampusHallOrderCustomFields
                }

                """批量接单逐单结果（P3-3）：单条失败不影响其余，message 为后端原文"""
                type CampusGrabResult {
                    orderId: ID!
                    ok: Boolean!
                    message: String
                }

                type CampusFavoriteVariant {
                    variantId: ID!
                    channelId: ID!
                }

                type CampusMySupportTicket {
                    id: ID!
                    orderCode: String
                    category: String!
                    content: String!
                    images: [String!]
                    status: String!
                    reply: String
                    repliedAt: DateTime
                    createdAt: DateTime!
                }

                type CampusMyRiderAppeal {
                    id: ID!
                    orderCode: String
                    reason: String!
                    images: [String!]
                    status: String!
                    creditDelta: Int
                    reviewNote: String
                    reviewedAt: DateTime
                    createdAt: DateTime!
                }

                """在线客服会话（C 端）：未读数为顾客侧口径"""
                type CampusMyChatConversation {
                    id: ID!
                    orderCode: String
                    subject: String
                    status: String!
                    lastMessage: String
                    lastMessageAt: DateTime
                    lastSenderType: String
                    unreadForCustomer: Int!
                    createdAt: DateTime!
                }

                type CampusMyChatMessage {
                    id: ID!
                    conversationId: ID!
                    senderType: String!
                    content: String
                    images: [String!]
                    readAt: DateTime
                    createdAt: DateTime!
                }

                type CampusRiderRating {
                    riderCustomerId: ID!
                    avgRating: Float!
                    ratingCount: Int!
                }

                type CampusMyRiderReviewRow {
                    id: ID!
                    orderId: ID!
                    rating: Int!
                    tags: [String!]
                    comment: String
                    createdAt: DateTime!
                }

                type CampusRateRiderResult {
                    ok: Boolean!
                    rating: Int!
                }

                type CampusRiderShiftRow {
                    id: ID!
                    shiftDate: String!
                    startTime: String!
                    endTime: String!
                    note: String
                }

                """骑手配送导航坐标（gcj02，供 uni.openLocation）"""
                type CampusRiderNav {
                    orderId: ID!
                    orderCode: String!
                    storeName: String
                    storeAddress: String
                    storePhone: String
                    storeLat: Float
                    storeLng: Float
                    buildingName: String
                    buildingDetail: String
                    buildingLat: Float
                    buildingLng: Float
                    campusZone: String
                    note: String
                    deliveryStatus: String
                }

                """C 端在投广告（P2-3）：仅返回当前渠道、指定广告位、投放窗口内的广告"""
                type CampusActiveAd {
                    id: ID!
                    slot: String!
                    title: String!
                    imageUrl: String
                    linkUrl: String
                    endDate: String!
                }

                """语音/拍照搜索识别结果（P2-2）：keywords 可直接作为站内搜索词"""
                type CampusSearchAssistResult {
                    ok: Boolean!
                    """识别类型：voice / image"""
                    type: String!
                    provider: String!
                    """识别出的整句文本（仅用于回显，可能为空）"""
                    text: String!
                    keywords: [String!]!
                    latencyMs: Int!
                    error: String
                }

                extend type Query {
                    myRiderProfile: RiderProfile!
                    campusZones: [CampusZone!]!
                    campusBuildings(zoneId: ID): [CampusBuilding!]!
                    campusHall: [Order!]!
                    campusHallAll: [CampusHallOrder!]!
                    campusMyTasks(status: String): [Order!]!
                    campusShopSlots: [DeliverySlot!]!
                    myRiderEarnings(skip: Int, take: Int): [RiderEarning!]!
                    campusCapacityCheck: CampusCapacityCheck!
                    waimaiStoreList: [WaimaiStore!]!
                    campusOrderRider(orderId: ID!): CampusOrderRider
                    """骑手侧顾客联系方式（号码保护）：仅本单骑手可查"""
                    campusRiderCustomerContact(orderId: ID!): CampusPrivacyContact!
                    campusR2Relay(orderId: ID!): CampusR2Relay
                    campusErrandVariant: CampusErrandVariantResult!
                    myRiderWallet: RiderWallet!
                    riderBalanceHistory(skip: Int, take: Int): [RiderBalanceTx!]!
                    riderWithdrawRequests(skip: Int, take: Int): [RiderWithdrawalRequest!]!
                    campusFavoriteStores: [String!]!
                    campusFavoriteVariants: [CampusFavoriteVariant!]!
                    """本单最近一次改址的差额状态（待补/待退/已结清）"""
                    campusMyAddressChange(orderId: ID!): CampusMyAddressChange
                    campusMySupportTickets(skip: Int, take: Int): [CampusMySupportTicket!]!
                    campusMyChatConversations(skip: Int, take: Int): [CampusMyChatConversation!]!
                    campusChatMessages(conversationId: ID!, afterId: ID, take: Int): [CampusMyChatMessage!]!
                    campusMyRiderAppeals(skip: Int, take: Int): [CampusMyRiderAppeal!]!
                    campusMyRiderRating: CampusRiderRating!
                    campusMyRiderReviews(skip: Int, take: Int): [CampusMyRiderReviewRow!]!
                    """本人云端口味偏好 JSON（未登录返回空串）"""
                    campusMyTasteProfile: String
                    campusMyShifts(from: String, to: String): [CampusRiderShiftRow!]!
                    campusRiderNav(orderId: ID!): CampusRiderNav
                    """语音/拍照搜索识别：type=voice/image，按渠道配置的服务商（内置 mock）"""
                    campusSearchAssist(type: String!, payload: String): CampusSearchAssistResult!
                    """C 端公开：按广告位取当前在投广告（最多 3 条，按投放金额降序）"""
                    campusActiveAds(slot: String!): [CampusActiveAd!]!
                    """C 端公开：本渠道启用的智能取餐柜站点（P2-4）"""
                    campusLockerStations: [CampusLockerStation!]!
                    """C 端公开：无人配送是否开通（P2-4 接口占位）"""
                    campusUnmannedDeliveryChannel: CampusUnmannedDeliveryChannelInfo!
                }

                """C 端取餐柜站点：仅启用站点，按 sort / 创建时间"""
                type CampusLockerStation {
                    id: ID!
                    name: String!
                    location: String!
                    provider: String!
                    providerName: String!
                    totalCells: Int!
                    availableCells: Int!
                    openHours: String
                    pickupGuide: String
                }

                type CampusUnmannedDeliveryChannelInfo {
                    enabled: Boolean!
                    provider: String!
                    providerName: String!
                }

                type CampusMyAddressChange {
                    id: ID!
                    diff: Int!
                    status: String!
                    settleAction: String
                    fromZone: String!
                    fromBuilding: String!
                    toZone: String!
                    toBuilding: String!
                    createdAt: DateTime!
                }

                type CampusAddressChangeResult {
                    diff: Int!
                    oldFee: Int!
                    newFee: Int!
                    fromZone: String!
                    toZone: String!
                    recordId: ID!
                }

                extend type Mutation {
                    applyRider(realName: String!, studentNo: String!, campus: String!, idImg: String, healthCertImg: String): RiderApplyResult!
                    campusGrabOrder(orderId: ID!): Order!
                    """批量接单（P3-3）：逐单独立事务，返回每条结果；单渠道一次最多 10 单"""
                    campusGrabOrders(orderIds: [ID!]!): [CampusGrabResult!]!
                    campusStartTask(orderId: ID!, code: String): Order!
                    campusTransferTask(orderId: ID!, photos: [String!]!, note: String): Order!
                    campusDeliverTask(orderId: ID!, photos: [String!]!, note: String): Order!
                    campusRiderReportLocation(orderId: ID!, lat: Float!, lng: Float!): Order!
                    campusUrgeOrder(orderId: ID!): Order!
                    campusReportException(orderId: ID!, type: String!, photos: [String!]!, note: String): Order!
                    campusSetDeliveryTarget(zoneId: ID!, buildingId: ID!, route: String, slotId: Int): Order!
                    campusChangeDeliveryAddress(orderId: ID!, zoneId: ID!, buildingId: ID!, detail: String): CampusAddressChangeResult!
                    applyOrderInvoice(orderId: ID!, invoiceInfo: String!): Boolean!
                    """保存本人云端口味偏好（空串=清除）"""
                    campusUpdateTasteProfile(input: String!): String!
                    campusRejectAssignment(orderId: ID!): CampusRejectResult!
                    campusRiderOnline(online: Boolean!): CampusRiderOnlineResult!
                    campusRiderHeartbeat: CampusRiderOnlineResult!
                    campusSetErrandInfo(input: CampusErrandInput!): CampusErrandInfoResult!
                    campusMarkArrived(orderId: ID!): CampusArrivedResult!
                    riderWithdraw(amount: Int!, channel: String!, account: String!): RiderWithdrawalRequest!
                    campusToggleFavoriteStore(channelId: ID!): [String!]!
                    campusToggleFavoriteVariant(variantId: ID!, channelId: ID!): [CampusFavoriteVariant!]!
                    campusCreateSupportTicket(category: String!, content: String!, images: [String!], orderCode: String): CampusMySupportTicket!
                    campusStartChat(orderCode: String, subject: String): CampusMyChatConversation!
                    campusSendChatMessage(conversationId: ID!, content: String, images: [String!]): CampusMyChatMessage!
                    campusMarkChatRead(conversationId: ID!): CampusMyChatConversation!
                    campusCloseChat(conversationId: ID!): CampusMyChatConversation!
                    campusCreateRiderAppeal(reason: String!, orderId: ID, images: [String!]): CampusMyRiderAppeal!
                    campusRateRider(orderId: ID!, rating: Int!, tags: [String!], comment: String): CampusRateRiderResult!
                    """P4-4 批量埋点上报（匿名可用），返回入库条数"""
                    campusTrackEvents(input: CampusTrackEventBatchInput!): Int!
                    """P4-4 前端错误上报（匿名可用）"""
                    campusReportError(input: CampusErrorReportInput!): Boolean!
                    """待付款订单续付：校验归属后把该订单设为活跃订单，前端随后调用 addPaymentToOrder"""
                    campusResumePaymentOrder(orderId: ID!): Order!
                }

                input CampusTrackEventInput {
                    eventName: String!
                    page: String
                    sessionId: String
                    """JSON 字符串或对象"""
                    props: String
                    createdAt: String
                }

                input CampusTrackEventBatchInput {
                    events: [CampusTrackEventInput!]!
                }

                input CampusErrorReportInput {
                    """c-end / admin，缺省 c-end"""
                    source: String
                    """error / warn，缺省 error"""
                    level: String
                    message: String!
                    stack: String
                    page: String
                    url: String
                }
            `;
            },
            resolvers: [hall_shop_resolver_1.OrderDeliveryShopResolver, rider_shop_resolver_1.RiderShopResolver, hall_shop_resolver_1.HallShopResolver, rider_task_shop_resolver_1.RiderTaskShopResolver, errand_shop_resolver_1.ErrandShopResolver, waimai_shop_resolver_1.WaimaiShopResolver, r2_shop_resolver_1.R2ShopResolver, campus_invoice_resolver_1.InvoiceShopResolver, favorite_shop_resolver_1.FavoriteShopResolver, address_change_resolver_1.AddressChangeShopResolver, support_shop_resolver_1.SupportShopResolver, chat_shop_resolver_1.ChatShopResolver, campus_ad_resolver_1.CampusAdShopResolver, campus_locker_resolver_1.CampusLockerShopResolver, taste_profile_shop_resolver_1.TasteProfileShopResolver, telemetry_resolver_1.TelemetryShopResolver, resume_payment_shop_resolver_1.ResumePaymentShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...permissions_1.campusPermissionDefinitions,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [...((_b = config.customFields.Order) !== null && _b !== void 0 ? _b : []), ...((_c = custom_fields_1.campusCustomFields.Order) !== null && _c !== void 0 ? _c : [])], OrderLine: [...((_d = config.customFields.OrderLine) !== null && _d !== void 0 ? _d : []), ...((_e = custom_fields_1.campusCustomFields.OrderLine) !== null && _e !== void 0 ? _e : [])], Customer: [...((_f = config.customFields.Customer) !== null && _f !== void 0 ? _f : []), ...((_g = custom_fields_1.campusCustomFields.Customer) !== null && _g !== void 0 ? _g : [])], Channel: [...((_h = config.customFields.Channel) !== null && _h !== void 0 ? _h : []), ...((_j = custom_fields_1.campusCustomFields.Channel) !== null && _j !== void 0 ? _j : [])], Product: [...((_k = config.customFields.Product) !== null && _k !== void 0 ? _k : []), ...((_l = custom_fields_1.campusCustomFields.Product) !== null && _l !== void 0 ? _l : [])], Address: [...((_m = config.customFields.Address) !== null && _m !== void 0 ? _m : []), ...((_o = custom_fields_1.campusCustomFields.Address) !== null && _o !== void 0 ? _o : [])] });
            config.shippingOptions.shippingCalculators = [
                ...((_p = config.shippingOptions.shippingCalculators) !== null && _p !== void 0 ? _p : []),
                shipping_calculator_1.campusErrandCalculator,
            ];
            // 起送价硬校验（二期 §3.2）：ArrangingPayment 过渡拦截，跑腿单豁免
            // 取消守卫：C 端在骑手已接单/配送中/已送达时不可自助取消（后台强制路径不受限）
            config.orderOptions = Object.assign(Object.assign({}, ((_q = config.orderOptions) !== null && _q !== void 0 ? _q : {})), { process: [...((_s = (_r = config.orderOptions) === null || _r === void 0 ? void 0 : _r.process) !== null && _s !== void 0 ? _s : []), packing_fee_process_1.campusPackingFeeProcess, addon_fee_process_1.campusAddonFeeProcess, min_order_process_1.campusMinOrderProcess, order_gate_process_1.campusOrderGateProcess, cancel_guard_process_1.campusCancelGuardProcess] });
            // 跑腿单 ShippingLine 分配：包装既有策略（cjk Box 按配送档案分箱，跑腿 0 元载体无档案
            // 绑定会被返回空数组 → 孤儿线）。本插件在 dev-config 中位于 CjkPlugin 之后，
            // configuration 钩子后执行，此处拿到的即为 cjk 已设置的策略，包装后原行为不变。
            const prevAssignmentStrategy = config.shippingOptions.shippingLineAssignmentStrategy;
            if (prevAssignmentStrategy) {
                config.shippingOptions.shippingLineAssignmentStrategy =
                    new errand_shipping_line_assignment_1.CampusErrandShippingLineAssignmentStrategy(prevAssignmentStrategy);
            }
            // 待付款补偿任务：不再注册 ScheduledTask（生产无 worker 不执行），改由 PaymentTimeoutJob 自管定时器
            return config;
        },
        compatibility: '^3.6.4',
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        hall_service_1.HallService,
        r4_tag_service_1.R4TagService,
        core_2.ModuleRef,
        campus_notify_service_1.CampusNotifyService,
        payment_timeout_job_1.PaymentTimeoutJob,
        campus_config_service_1.CampusConfigService,
        slot_lock_service_1.SlotLockService,
        core_1.TransactionalConnection])
], CampusDeliveryPlugin);
//# sourceMappingURL=campus-delivery.plugin.js.map