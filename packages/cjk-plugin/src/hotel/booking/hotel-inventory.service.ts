// 房态库存与锁房服务（P1）：
// - 防超订：hold/confirm/release 三态锁房单 + 事务内悲观行锁（SELECT…FOR UPDATE，mysql/pg 通用 setLock）
// - 校验与落锁必须由调用方保证在同一事务内（OrderInterceptor 处于 mutation 事务；非事务上下文用 withTransaction 自包）
// - 房量回退：HotelRoomDay 行 ?? hotelRoomConfig.totalRooms ?? 不限房（null）
import { Injectable } from '@nestjs/common';
import { ID, Logger, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { In, IsNull, Not } from 'typeorm';
import { parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelRoomDay } from './room-day.entity';
import { HotelBookingLock, HotelBookingLockStatus } from './booking-lock.entity';
import {
    HOTEL_HOLD_TTL_MINUTES,
    HotelSoldOutError,
    computeRemaining,
    countOccupied,
    enumerateNights,
    findShortNights,
} from './hotel-inventory-logic';

const loggerCtx = 'HotelInventoryService';

export { HotelSoldOutError };

@Injectable()
export class HotelInventoryService {
    constructor(private conn: TransactionalConnection) {}

    private roomDayRepo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, HotelRoomDay);
    }

    private lockRepo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, HotelBookingLock);
    }

    /** 变体缺省总房量（hotelRoomConfig.totalRooms）；坏配置/未配置 → null（不限房） */
    async getVariantTotalRooms(ctx: RequestContext, variantId: ID): Promise<number | null> {
        const variant = await this.conn.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId as any },
            loadEagerRelations: false,
        });
        if (!variant) return null;
        const cfg = parseHotelRoomConfig((variant.customFields as any)?.hotelRoomConfig);
        const n = cfg?.totalRooms;
        return typeof n === 'number' && n >= 0 ? Math.round(n) : null;
    }

    /** 逐晚剩余房量（from..to 含 checkIn 不含 checkOut 段内每一晚） */
    async getAvailability(
        ctx: RequestContext,
        variantId: ID,
        from: string,
        to: string,
    ): Promise<Array<{ date: string; remaining: number | null; closed: boolean }>> {
        const nights = enumerateNights(from, to);
        if (!nights.length) return [];
        const configTotal = await this.getVariantTotalRooms(ctx, variantId);
        const roomDays = await this.roomDayRepo(ctx).find({ where: { productVariantId: Number(variantId), date: In(nights) } });
        const roomDayByDate = new Map(roomDays.map(r => [r.date, r]));
        // 有限房量的晚才需要统计占用；不限房的晚直接 null
        const limitedDates = nights.filter(d => roomDayByDate.has(d) || configTotal != null);
        const occupied = new Map<string, number>();
        if (limitedDates.length) {
            const locks = await this.lockRepo(ctx).find({
                where: { productVariantId: Number(variantId), date: In(limitedDates) },
            });
            const now = new Date();
            for (const d of limitedDates) {
                occupied.set(d, countOccupied(locks, d, now));
            }
        }
        return nights.map(date => {
            const roomDay = roomDayByDate.get(date);
            return {
                date,
                remaining: computeRemaining(roomDay, configTotal, occupied.get(date) ?? 0),
                closed: roomDay?.closed ?? false,
            };
        });
    }

    /**
     * 锁房（校验 + 落锁，一体完成）：
     * - 对段内「有限房量」的 HotelRoomDay 行悲观加锁（无行时先 upsert 缺省行以获得锁锚点）
     * - 先释放本订单该房型的既有 hold（幂等自愈：加购/改行/重复调用收敛到最终状态）
     * - 逐晚校验 remaining ≥ 新增间数，任一晚不足抛 HotelSoldOutError（调用方回滚整体）
     * - 落 hold（每间每晚一行，TTL 15min）；不限房晚不落锁
     */
    async holdForOrder(
        ctx: RequestContext,
        orderId: ID,
        variantId: ID,
        checkIn: string,
        checkOut: string,
        quantity: number,
        options: { orderLineId?: ID } = {},
    ): Promise<void> {
        const nights = enumerateNights(checkIn, checkOut);
        if (!nights.length || quantity < 1) return;
        const vId = Number(variantId);
        const configTotal = await this.getVariantTotalRooms(ctx, vId);

        // 缺省行 upsert：仅当「有限房量」且无显式行时补一行（把回退值固化成锁锚点）
        const existing = await this.roomDayRepo(ctx).find({ where: { productVariantId: vId, date: In(nights) } });
        const existingDates = new Set(existing.map(r => r.date));
        if (configTotal != null) {
            for (const date of nights.filter(d => !existingDates.has(d))) {
                await this.roomDayRepo(ctx).insert({ productVariantId: vId, date, totalRooms: configTotal, closed: false });
            }
        }
        // 悲观锁：锁定段内全部 roomDay 行（不限房晚若无行则无行可锁——本就不参与占用统计）
        if (existing.length || configTotal != null) {
            await this.roomDayRepo(ctx)
                .createQueryBuilder('rd')
                .setLock('pessimistic_write')
                .where('rd.productVariantId = :vId', { vId })
                .andWhere('rd.date IN (:...dates)', { dates: nights })
                .getMany();
        }

        const roomDays = await this.roomDayRepo(ctx).find({ where: { productVariantId: vId, date: In(nights) } });
        const roomDayByDate = new Map(roomDays.map(r => [r.date, r]));
        const limitedDates = nights.filter(d => roomDayByDate.has(d) || configTotal != null);
        const now = new Date();

        // 占用统计需在「扣除本单既有 hold 后」校验：本单旧 hold 即将释放
        const ownLocks = await this.lockRepo(ctx).find({
            where: { orderId: Number(orderId), productVariantId: vId, status: 'hold' as HotelBookingLockStatus },
        });
        const occupiedByDate = new Map<string, number>();
        if (limitedDates.length) {
            const locks = await this.lockRepo(ctx).find({
                where: { productVariantId: vId, date: In(limitedDates) },
            });
            for (const d of limitedDates) {
                occupiedByDate.set(d, countOccupied(locks, d, now, Number(orderId)));
            }
        }

        const remainingByDate = new Map<string, number | null>();
        for (const d of nights) {
            remainingByDate.set(d, computeRemaining(roomDayByDate.get(d), configTotal, occupiedByDate.get(d) ?? 0));
        }
        const short = findShortNights(nights, remainingByDate, quantity);
        if (short.length) {
            throw new HotelSoldOutError(short, vId);
        }

        // 释放本单该房型全部 hold（幂等），再按最终数量落新 hold
        await this.lockRepo(ctx).update(
            { orderId: Number(orderId), productVariantId: vId, status: 'hold' as HotelBookingLockStatus },
            { status: 'released', holdExpiresAt: null },
        );
        const expiresAt = new Date(now.getTime() + HOTEL_HOLD_TTL_MINUTES * 60_000);
        const rows: Array<Partial<HotelBookingLock>> = [];
        for (const date of nights) {
            if (!roomDayByDate.has(date) && configTotal == null) continue; // 不限房不落锁
            for (let i = 0; i < quantity; i++) {
                rows.push({
                    productVariantId: vId,
                    date,
                    orderId: Number(orderId),
                    orderLineId: options.orderLineId ? Number(options.orderLineId) : null,
                    bookingId: null,
                    status: 'hold',
                    holdExpiresAt: expiresAt,
                });
            }
        }
        if (rows.length) {
            await this.lockRepo(ctx).insert(rows as any);
        }
    }

    /** hold → booked（确认）：可选回填 orderLineId / bookingId；已 booked 的行跳过 */
    async confirmLocks(
        ctx: RequestContext,
        orderId: ID,
        variantId: ID,
        options: { orderLineId?: ID; bookingId?: ID } = {},
    ): Promise<void> {
        const patch: Partial<HotelBookingLock> = { status: 'booked', holdExpiresAt: null };
        if (options.orderLineId != null) patch.orderLineId = Number(options.orderLineId);
        if (options.bookingId != null) patch.bookingId = Number(options.bookingId);
        await this.lockRepo(ctx).update(
            { orderId: Number(orderId), productVariantId: Number(variantId), status: 'hold' as HotelBookingLockStatus },
            patch as any,
        );
    }

    /** 任意状态 → released（取消/退款/移除行）；released 幂等 */
    async releaseLocks(ctx: RequestContext, orderId: ID, variantId?: ID): Promise<number> {
        const where: any = { orderId: Number(orderId), status: Not('released') as any };
        if (variantId != null) where.productVariantId = Number(variantId);
        const res = await this.lockRepo(ctx).update(where, { status: 'released', holdExpiresAt: null });
        return res.affected ?? 0;
    }

    /** 按订单行释放（移除订单行） */
    async releaseLocksByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<number> {
        const res = await this.lockRepo(ctx).update(
            { orderLineId: Number(orderLineId), status: Not('released') as any },
            { status: 'released', holdExpiresAt: null },
        );
        return res.affected ?? 0;
    }

    /** 定时清理：过期 hold → released（清理统计面；released 行保留审计） */
    async expireStaleHolds(ctx: RequestContext, now?: Date): Promise<number> {
        const res = await this.lockRepo(ctx)
            .createQueryBuilder()
            .update(HotelBookingLock)
            .set({ status: 'released' as HotelBookingLockStatus, holdExpiresAt: null })
            .where('status = :status', { status: 'hold' })
            .andWhere('holdExpiresAt IS NOT NULL')
            .andWhere('holdExpiresAt < :now', { now: now ?? new Date() })
            .execute();
        if (res.affected) {
            Logger.info(`过期锁房单释放 ${res.affected} 行`, loggerCtx);
        }
        return res.affected ?? 0;
    }

    /** 行创建后回填 orderLineId（按订单+房型，补齐审计链） */
    async attachOrderLineId(ctx: RequestContext, orderId: ID, variantId: ID, orderLineId: ID): Promise<void> {
        await this.lockRepo(ctx).update(
            { orderId: Number(orderId), productVariantId: Number(variantId), orderLineId: IsNull() as any },
            { orderLineId: Number(orderLineId) },
        );
    }
}
