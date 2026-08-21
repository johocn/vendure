import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    EntityNotFoundError,
    ID,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
} from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';

import { DeliveryAddress } from './delivery-address.entity';
import { DeliveryRange } from './delivery-range.entity';
import { computeShopFees, hasOrderShippingCodes, readOrderShippingCodes, resolveOrderShopMap } from './shipping-rules';

export interface AddressInput {
    fullName: string;
    phone: string;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    provinceCode?: string | null;
    cityCode?: string | null;
    districtCode?: string | null;
    detail?: string | null;
    lng?: number | null;
    lat?: number | null;
}

export interface RangeInput {
    shopId: ID;
    enabled?: boolean;
    rangeType?: string;
    centerLng?: number | null;
    centerLat?: number | null;
    radiusKm?: number | null;
    districtCodes?: string[] | null;
    /** 基础运费（分）。 */
    baseFee?: number | null;
    /** 满额包邮阈值（分）；null=该店不支持包邮。 */
    freeThreshold?: number | null;
}

export interface DeliveryResult {
    shopId: ID;
    inRange: boolean;
    reason: string;
}

@Injectable()
export class DeliveryService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    /** 当前登录顾客；未登录抛 Unauthorized，无顾客抛 NotFound（对齐 review 口径）。 */
    private async requireCustomer(ctx: RequestContext): Promise<any> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    // ---------- 收货地址簿 ----------

    async listMyAddresses(ctx: RequestContext): Promise<DeliveryAddress[]> {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, DeliveryAddress).find({
            where: { customerId: customer.id, channelId: ctx.channelId as number } as any,
            order: { id: 'ASC' } as any,
        });
    }

    async createAddress(ctx: RequestContext, input: AddressInput): Promise<DeliveryAddress> {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, DeliveryAddress).count({
            where: { customerId: customer.id, channelId: ctx.channelId as number } as any,
        });
        const addr = new DeliveryAddress({
            ...input,
            customerId: customer.id,
            isDefault: count === 0 ? true : false,
            channelId: ctx.channelId as number,
        } as any);
        return this.connection.getRepository(ctx, DeliveryAddress).save(addr);
    }

    async getAddress(ctx: RequestContext, id: ID): Promise<DeliveryAddress> {
        const customer = await this.requireCustomer(ctx);
        const addr = await this.connection.getRepository(ctx, DeliveryAddress).findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId as number } as any,
        });
        if (!addr) {
            throw new EntityNotFoundError('DeliveryAddress', id);
        }
        return addr;
    }

    async updateAddress(ctx: RequestContext, id: ID, input: AddressInput): Promise<DeliveryAddress> {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, DeliveryAddress);
        const addr = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId as number } as any,
        });
        if (!addr) {
            throw new EntityNotFoundError('DeliveryAddress', id);
        }
        Object.assign(addr, input);
        return repo.save(addr);
    }

    async deleteAddress(ctx: RequestContext, id: ID): Promise<boolean> {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, DeliveryAddress);
        const addr = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId as number } as any,
        });
        if (!addr) {
            throw new EntityNotFoundError('DeliveryAddress', id);
        }
        await repo.remove(addr);
        return true;
    }

    /** 设为默认：事务内先清空该顾客全部默认，再置目标为默认（保证唯一）。 */
    async setDefaultAddress(ctx: RequestContext, id: ID): Promise<DeliveryAddress[]> {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, DeliveryAddress);
        const target = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId as number } as any,
        });
        if (!target) {
            throw new EntityNotFoundError('DeliveryAddress', id);
        }
        await this.connection.withTransaction(ctx, async (txCtx) => {
            const rp = this.connection.getRepository(txCtx, DeliveryAddress);
            const mine = await rp.find({
                where: { customerId: customer.id, channelId: ctx.channelId as number } as any,
            });
            for (const a of mine) {
                a.isDefault = a.id === Number(id);
                await rp.save(a);
            }
        });
        return this.listMyAddresses(ctx);
    }

    // ---------- 配送范围 ----------

    /** 校验 shop 存在（复用 shop-plugin Shop，repository 直接取避免 DI 环）。 */
    private async requireShop(ctx: RequestContext, shopId: ID): Promise<void> {
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { id: Number(shopId) } as any });
        if (!shop) {
            throw new EntityNotFoundError('Shop', shopId);
        }
    }

    async getRange(ctx: RequestContext, shopId: ID): Promise<DeliveryRange | null> {
        return this.connection.getRepository(ctx, DeliveryRange).findOne({
            where: { shopId: Number(shopId), channelId: ctx.channelId as number } as any,
        });
    }

    /** 每店每渠道单档 upsert：存在则 update，否则 insert（幂等）。 */
    async upsertRange(ctx: RequestContext, input: RangeInput): Promise<DeliveryRange> {
        await this.requireShop(ctx, input.shopId);
        const repo = this.connection.getRepository(ctx, DeliveryRange);
        let range = await repo.findOne({
            where: { shopId: Number(input.shopId), channelId: ctx.channelId as number } as any,
        });
        if (!range) {
            range = new DeliveryRange({
                shopId: Number(input.shopId),
                channelId: ctx.channelId as number,
            } as any);
        }
        if (input.enabled !== undefined) range.enabled = input.enabled;
        if (input.rangeType !== undefined) range.rangeType = input.rangeType;
        if (input.centerLng !== undefined) range.centerLng = input.centerLng;
        if (input.centerLat !== undefined) range.centerLat = input.centerLat;
        if (input.radiusKm !== undefined) range.radiusKm = input.radiusKm;
        if (input.districtCodes !== undefined) {
            range.districtCodes = input.districtCodes ? JSON.stringify(input.districtCodes) : null;
        }
        if (input.baseFee !== undefined) range.baseFee = input.baseFee ?? 0;
        if (input.freeThreshold !== undefined) range.freeThreshold = input.freeThreshold ?? null;
        return repo.save(range);
    }

    // ---------- 配送校验 ----------

    async validateDelivery(ctx: RequestContext, address: AddressInput, shopIds: ID[]): Promise<DeliveryResult[]> {
        const results: DeliveryResult[] = [];
        for (const shopId of shopIds) {
            const range = await this.getRange(ctx, shopId);
            results.push(this.evaluateRange(range, shopId, address));
        }
        return results;
    }

    // ---------- 订单运费联动 ----------

    /** 当前订单行所属商品去重后的 shopId 列表（沿 Product.shopId 反查）。 */
    async getOrderShopIds(ctx: RequestContext, order: any): Promise<number[]> {
        const map = await resolveOrderShopMap(this.connection, ctx, order);
        return [...new Set(map.values())];
    }

    /** 读取订单当前收件码/经纬度并逐店校验可得性。 */
    async evaluateOrderDelivery(ctx: RequestContext, order: any, shopIds?: number[]) {
        const ids = shopIds ?? (await this.getOrderShopIds(ctx, order));
        const addr = readOrderShippingCodes(order);
        return this.validateDelivery(ctx, addr as AddressInput, ids as ID[]);
    }

    /** 是否已具备收件码可参与校验。 */
    hasOrderShippingCodes(order: any): boolean {
        return hasOrderShippingCodes(order);
    }

    /** 从地址簿写入订单收件码/经纬度（stage22 前置：setOrderShippingFromAddress）。 */
    applyAddressToOrderShipping(order: any, address: DeliveryAddress): void {
        const cf = (order.customFields ?? {}) as Record<string, any>;
        cf.shippingProvinceCode = address.provinceCode ?? null;
        cf.shippingCityCode = address.cityCode ?? null;
        cf.shippingDistrictCode = address.districtCode ?? null;
        cf.shippingLng = address.lng ?? null;
        cf.shippingLat = address.lat ?? null;
        order.customFields = cf;
    }

    private evaluateRange(range: DeliveryRange | null, shopId: ID, addr: AddressInput): DeliveryResult {
        if (!range || !range.enabled) {
            return { shopId, inRange: false, reason: 'NO_DELIVERY' };
        }
        if (range.rangeType === 'all') {
            return { shopId, inRange: true, reason: 'OK' };
        }
        if (range.rangeType === 'circle') {
            if (addr.lat == null || addr.lng == null) {
                return { shopId, inRange: false, reason: 'NO_COORDINATES' };
            }
            const d = this.haversineKm(range.centerLat ?? 0, range.centerLng ?? 0, addr.lat, addr.lng);
            if (d <= (range.radiusKm ?? 0)) {
                return { shopId, inRange: true, reason: 'OK' };
            }
            return { shopId, inRange: false, reason: 'BEYOND_RANGE' };
        }
        if (range.rangeType === 'district') {
            const whitelist = this.parseDistrictCodes(range.districtCodes);
            const has = [addr.districtCode, addr.cityCode, addr.provinceCode].some(
                code => code != null && whitelist.has(code),
            );
            if (has) {
                return { shopId, inRange: true, reason: 'OK' };
            }
            return { shopId, inRange: false, reason: 'NOT_IN_RANGE' };
        }
        return { shopId, inRange: false, reason: 'UNKNOWN_TYPE' };
    }

    private parseDistrictCodes(raw: string | null): Set<string> {
        if (!raw) {
            return new Set();
        }
        try {
            return new Set<string>(JSON.parse(raw) as string[]);
        } catch {
            return new Set();
        }
    }

    /** 大地距离（km），haversine 公式。 */
    private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
}