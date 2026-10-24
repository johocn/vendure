import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { SubscribeMessageService } from '@vendure/wechat-subscribe-message-plugin';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusBuilding } from './campus-building.entity';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';
import { resolveHandoverPoint, resolveRoutePlan } from './route-matrix';

/** 仍在履约链路上的大厅状态（取消脱厅/回厅/条件状态迁移共用）。
 * 终态（delivered/cancelled/no_rider_final/exception_final）不在其中，任何写入都不应把终态单改回流转态。 */
export const ACTIVE_HALL_STATUSES = [
    'open', 'pending_merchant', 'accepted', 'scheduled', 'grabbed', 'third_party',
    'merchant_delivering', 'owned_pool', 'owned_dispatched', 'pending_dispatch',
];

/** customFields 字段名 → 物理列名（Vendure 规则：customFields + 首字母大写 + 其余小写）
 * 例：hallStatus → customFieldsHallstatus；thirdPartyDispatchAt → customFieldsThirdpartydispatchat */
const orderColumn = (field: string) => `"customFields${field.charAt(0).toUpperCase()}${field.slice(1).toLowerCase()}"`;

/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在**支付成功后**自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 * 支付闸门：由插件订阅 PaymentStateTransitionEvent（Authorized/Settled）触发，未支付订单不进大厅、不可被抢。
 */
@Injectable()
export class HallService {
    /** 预约单放量窗口：scheduledFor 前 30min 才进入商家确认/抢单大厅（plan 3.1） */
    static readonly SCHEDULE_RELEASE_MIN = 30;

    constructor(
        private connection: TransactionalConnection,
        private slotLock: SlotLockService,
        private moduleRef: ModuleRef,
        private capacity: CapacityService,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    /** 收货楼栋坐标（用于挑最近交接点）；楼栋未配坐标返回 null */
    private async resolveDestPoint(
        ctx: RequestContext,
        order: Order,
    ): Promise<{ lat: number; lng: number } | null> {
        const cf = order.customFields as any;
        const buildingId = cf?.buildingId ?? (order.shippingAddress?.customFields as any)?.buildingId;
        if (!buildingId) return null;
        const b = await this.connection
            .getRepository(ctx, CampusBuilding)
            .findOne({ where: { id: Number(buildingId) as any } });
        if (!b || b.lat == null || b.lng == null) return null;
        return { lat: Number(b.lat), lng: Number(b.lng) };
    }

    /** 预约单时段文本（'2026-10-06 11:00-11:30' 或 '11:00-11:30'）解析时长；无法解析返回 null */
    static slotSpanMinutes(text: string): number | null {
        const m = /(\d{1,2}):(\d{2})\s*[-–~至]\s*(\d{1,2}):(\d{2})/.exec(text);
        if (!m) return null;
        const start = Number(m[1]) * 60 + Number(m[2]);
        const end = Number(m[3]) * 60 + Number(m[4]);
        const span = end - start;
        return span > 0 && span <= 12 * 60 ? span : null;
    }

    /**
     * 承诺送达时间（支付时固化，超时赔付判定基准）：
     * - 预约单：时段结束时间（文本解析失败退回「时段开始 + 配送时长」）
     * - 即时单：支付时间 + 店铺配送时长（未配置按 40min）
     */
    private resolvePromise(cf: any, cfg?: CampusFulfillmentConfig | null): { at: Date; source: string } {
        const minutes = Math.max(10, Number(cfg?.deliveryMinutes ?? 40));
        const start = cf.scheduledFor ? new Date(cf.scheduledFor).getTime() : NaN;
        if (!Number.isNaN(start)) {
            const span = HallService.slotSpanMinutes(String(cf.deliverySlotText ?? ''));
            return { at: new Date(start + (span ?? minutes) * 60_000), source: span ? 'slot' : 'slot_estimate' };
        }
        return { at: new Date(Date.now() + minutes * 60_000), source: 'store_minutes' };
    }

    async onOrderPlaced(ctx: RequestContext, orderInput: Order) {
        // 支付事件（Authorized → Settled）可能连发两次：以 DB 当前值为准做幂等闸，
        // 事件里的实体快照不含上一次订阅写入的 customFields。
        // 读不到时退回事件实体（正常流程订单必然存在，兜底避免事件对象为空导致漏入厅）。
        const fresh = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderInput.id as any },
            relations: ['shippingAddress'],
        });
        const order = fresh ?? orderInput;
        if (order.state === 'Cancelled') return;
        const cf = order.customFields as any;
        if (cf.hallStatus) return; // 已入厅（或已挂 scheduled），幂等跳过
        const isErrand = cf.orderKind === 'errand';
        const route = String(cf.fulfillmentRoute ?? (isErrand ? 'R5' : ''));
        // 需要派单的只有 R1/R2/R3；R4 到店自取、R5 跑腿走原链路
        if (!isErrand && !['R1', 'R2', 'R3'].includes(route)) return;

        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        const plan = resolveRoutePlan(route, cfg ?? {});
        // R1/R2 恒接力，必须有校园交接点；缺失则降级为传信者到店取餐直送（不能让订单卡住）
        const needsPoint = route === 'R1' || route === 'R2';
        // 多交接点时按收货楼栋坐标取最近；楼栋无坐标退回该路线默认点
        const dest = needsPoint ? await this.resolveDestPoint(ctx, order) : null;
        const point = needsPoint ? resolveHandoverPoint(route as 'R1' | 'R2', cfg ?? {}, dest) : null;
        const degrade = needsPoint && !point;
        const promise = this.resolvePromise(cf, cfg);
        // 履约快照：下单时冻结，后续配置变更不影响在途单
        const snapshot = {
            deliveryPlan: degrade ? 'campus_rider' : (plan?.leg1 ?? 'campus_rider'),
            handoverMode: degrade ? '' : (plan?.handover ?? ''),
            thirdPartyProvider: '',
            handoverPointName: point?.name ?? '',
            handoverPointAddress: point?.address ?? '',
            handoverPointLat: point?.lat ?? null,
            handoverPointLng: point?.lng ?? null,
            promisedAt: promise.at,
            promiseSource: promise.source,
            ...(degrade ? { campusCause: 'no_handover_point' } : {}),
        };
        const locked = await this.slotLock.lock(ctx, order);
        const scheduledAt = cf.scheduledFor ? new Date(cf.scheduledFor).getTime() : NaN;
        const deferred =
            !Number.isNaN(scheduledAt) && scheduledAt - Date.now() > HallService.SCHEDULE_RELEASE_MIN * 60_000;
        const update = (patch: Record<string, unknown>) =>
            this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: {
                    ...snapshot,
                    ...(locked || snapshot.campusCause ? {} : { campusCause: 'slot_full' }),
                    ...patch,
                },
            } as any);

        // R1：商户/自营快递先完成第一段（送到校园交接点），出餐后由商家工作台分流
        if (route === 'R1' && !degrade) {
            if (deferred) {
                await update({ hallStatus: 'scheduled' });
                return;
            }
            await update({ hallStatus: 'pending_merchant' });
            Logger.info(`Order ${order.code} awaiting merchant (R1/${snapshot.deliveryPlan})`, 'CampusHall');
            return;
        }

        // R2：固定外部快递，但必须先经商户接单/出餐（出餐闸门），cookingDone 后才推送外部快递
        if (route === 'R2' && !degrade) {
            await update({ hallStatus: deferred ? 'scheduled' : 'pending_merchant' });
            Logger.info(`Order ${order.code} awaiting merchant (R2 cooking gate)`, 'CampusHall');
            return;
        }

        // R3：一段到底，按第一段进入对应池
        const leg1 = String(snapshot.deliveryPlan);
        if (deferred) {
            await update({ hallStatus: 'scheduled' });
            return;
        }
        if (leg1 === 'external_courier') {
            await update({ hallStatus: 'pending_dispatch' });
            Logger.info(`Order ${order.code} awaiting external push (R3)`, 'CampusHall');
            return;
        }
        if (leg1 === 'owned') {
            await update({ hallStatus: 'owned_pool' });
            Logger.info(`Order ${order.code} in owned pool (R3)`, 'CampusHall');
            return;
        }
        if (cfg?.merchantConfirmEnabled) {
            await update({ hallStatus: 'pending_merchant' });
            return;
        }
        await update({ hallStatus: 'open', hallEnteredAt: new Date() });
        Logger.info(`Order ${order.code} entered hall (${route}, slotLocked=${locked})`, 'CampusHall');
        this.notifyRiders(ctx, order);
    }

    /** 预约单放量（调度 job 调用，plan 3.1）：按路由/快照分流。
     * 放量即写 hallEnteredAt 作为「商家/运力计时锚点」：预约单 createdAt 可能早于放量数小时甚至数天，
     * 若下游超时兜底沿用 createdAt，一放量就会被判定超时（R1 直接转自营、R2 直接进大厅、跳过商家确认）。
     * 条件写（仅 scheduled 态）：与用户取消并发时不把已取消单复活。返回是否真正放量。 */
    async releaseScheduled(ctx: RequestContext, order: Order, cfg: CampusFulfillmentConfig | null): Promise<boolean> {
        const cf = order.customFields as any;
        const next = HallService.releaseTarget(cf, cfg);
        const released = await this.transitionFrom(ctx, Number(order.id), ['scheduled'], {
            hallStatus: next,
            hallEnteredAt: new Date(),
        });
        if (!released) {
            Logger.info(`Order ${order.code} scheduled release skipped (hall status changed)`, 'CampusHall');
            return false;
        }
        Logger.info(`Order ${order.code} scheduled → ${next}`, 'CampusHall');
        // 无人接单的渠道保持原行为：放量即提醒在线骑手
        if (next === 'open' || next === 'owned_pool') this.notifyRiders(ctx, order);
        return true;
    }

    /** 放量目标态（put 与调度 job 共用；job 用它在内存里同步订单快照，避免同轮二次误判） */
    static releaseTarget(cf: any, cfg: CampusFulfillmentConfig | null): string {
        const route = String(cf.fulfillmentRoute ?? '');
        if (route === 'R1' || route === 'R2') return 'pending_merchant'; // 出餐闸门：先等商户接单/出餐
        if (cf.deliveryPlan === 'external_courier') return 'pending_dispatch';
        if (cf.deliveryPlan === 'owned') return 'owned_pool';
        return cfg?.merchantConfirmEnabled ? 'pending_merchant' : 'open';
    }

    /** 第一段交接完成：订单进校园抢单大厅（R1/R2 接力上楼）。
     * 同时生成 4 位交接码（第二段骑手取货时校验，防丢餐扯皮），返回码值供调用方通知用户。 */
    async enterHallForHandover(ctx: RequestContext, orderId: number, cause: string): Promise<string> {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        if (!order) {
            Logger.warn(`enterHallForHandover 订单不存在 #${orderId}`, 'CampusHall');
            return '';
        }
        const handoverCode = String(Math.floor(1000 + Math.random() * 9000));
        await this.updateOrder(ctx, orderId, {
            customFields: {
                hallStatus: 'open',
                hallEnteredAt: new Date(),
                deliveryStatus: 'pending',
                assignedAt: null,
                deliveryStaffId: null,
                campusCause: cause,
                handoverCode,
                handoverCodeAt: new Date(),
            },
        } as any);
        this.notifyRiders(ctx, order);
        Logger.info(`订单 ${order.code} 交接完成进入大厅 (${cause})，交接码 ${handoverCode}`, 'CampusHall');
        return handoverCode;
    }

    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用）。
     *  条件写：仅活跃流转态可回厅，已取消/已终态单不被复活；返回是否命中。 */
    async backToHall(ctx: RequestContext, orderId: number): Promise<boolean> {
        return this.transitionFrom(ctx, orderId, ACTIVE_HALL_STATUSES, {
            hallStatus: 'open',
            deliveryStaffId: null,
            deliveryStatus: null,
            assignedAt: null,
        });
    }

    /**
     * 条件状态迁移（CAS）：仅当 hallStatus 仍在 from 集合内时才写入 patch，返回 affected>0。
     * 调度扫描/商家操作都是「先读后写」，若期间用户取消并脱厅（hallStatus=cancelled），
     * 无条件 update 会把已退款单改回 open/pending_merchant 重新进入大厅被抢。
     * 用单条 UPDATE + hallStatus 条件把「校验与写入」合并成一个原子动作。
     */
    async transitionFrom(
        _ctx: RequestContext,
        orderId: number,
        from: string[],
        patch: Record<string, unknown>,
    ): Promise<boolean> {
        const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
        if (!entries.length || !from.length) return false;
        const sets = entries.map(([k], i) => `${orderColumn(k)} = $${i + 2}`).join(', ');
        const values = entries.map(([, v]) => (Array.isArray(v) ? JSON.stringify(v) : v));
        const out: any = await this.connection.rawConnection.query(
            `UPDATE "order" SET ${sets} `
            + `WHERE id = $1 AND COALESCE("customFieldsHallstatus", '') = ANY($${entries.length + 2}::text[]) `
            + 'RETURNING id',
            [orderId, ...values, from],
        );
        const rows = Array.isArray(out) && Array.isArray(out[0]) ? out[0] : out;
        return Array.isArray(rows) && rows.length > 0;
    }

    /** 取消脱厅（3.3 冒烟实测缺陷）：订单取消终态时清 hallStatus，使其退出大厅/打包扫描/整组抢单/调度台。
     * 先读 DB 当前值防 T4 mark() 竞态覆盖（no_rider_final 不碰）；grabbed 单连带清骑手指派字段。 */
    async exitHall(ctx: RequestContext, order: Order) {
        const cur = await this.connection.getRepository(ctx, Order).findOne({ where: { id: order.id as any } });
        const hs = (cur?.customFields as any)?.hallStatus as string | undefined;
        if (!hs || !ACTIVE_HALL_STATUSES.includes(hs)) return;
        await this.connection.getRepository(ctx, Order).update(order.id as any, {
            customFields: {
                hallStatus: 'cancelled',
                ...(hs === 'grabbed' ? { deliveryStaffId: null, deliveryStatus: null, assignedAt: null } : {}),
            },
        } as any);
        Logger.info(`Order ${order.code} exited hall (${hs} → cancelled)`, 'CampusHall');
    }

    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx: RequestContext, orderId: number, patch: any) {
        return this.connection.getRepository(ctx, Order).update(orderId, patch as any);
    }

    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    private notifyRiders(ctx: RequestContext, order: Order) {
        void (async () => {
            try {
                const templateId = ((ctx.channel as any)?.customFields ?? {}).orderShippedTemplateId as
                    | string
                    | undefined;
                if (!templateId) {
                    Logger.debug(
                        `Channel ${ctx.channelId} has no orderShippedTemplateId, skip rider notify`,
                        'CampusHall',
                    );
                    return;
                }
                const msg = this.injector.get(SubscribeMessageService);
                const riders = await this.capacity.listOnlineRiders(ctx);
                for (const r of riders) {
                    try {
                        await msg.sendCustomMessage(ctx, r.id as any, templateId, {
                            orderCode: { value: order.code },
                            zone: { value: (order.customFields as any).campusZone ?? '' },
                        });
                    } catch (e: any) {
                        Logger.warn(`rider notify failed (customer ${r.id}): ${e?.message}`, 'CampusHall');
                    }
                }
            } catch (e: any) {
                Logger.warn(`rider notify failed: ${e?.message}`, 'CampusHall');
            }
        })();
    }
}
