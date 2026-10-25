import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    Logger,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { AddressBookItem } from './types';

/**
 * 地址簿服务（微信对话 CRUD + 默认地址，方案 B 列表式逐轮问答的数据层）：
 * - 列表按 id 升序（最早录入在前），index 从 1 起（对话回复编号定位）；
 * - 新增/设默认复用 core customerService.createAddress/updateAddress 内置的
 *   enforceSingleDefaultAddress（默认地址顾客内唯一，设新自动清旧）；
 * - 删除复用 core deleteAddress 内置的 reassignDefaultsForDeletedAddress
 *   （删除默认地址后剩余最早地址自动顶替）。
 */
@Injectable()
export class AddressBookService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    /** 顾客地址簿（id 升序 = 录入顺序，index 从 1 起） */
    async list(ctx: RequestContext, customerId: string | number): Promise<AddressBookItem[]> {
        const customer = await this.connection.getRepository(ctx, Customer).findOne({
            where: { id: customerId as any },
            relations: { addresses: true },
        });
        const addresses = (customer?.addresses ?? []).slice().sort((a, b) => (Number(a.id) < Number(b.id) ? -1 : 1));
        return addresses.map((a, i) => {
            const cf = (a.customFields ?? {}) as any;
            return {
                id: String(a.id),
                index: i + 1,
                fullName: a.fullName ?? '',
                phoneNumber: a.phoneNumber ?? '',
                streetLine1: a.streetLine1 ?? '',
                isDefault: !!a.defaultShippingAddress,
                latitude: typeof cf.latitude === 'number' ? cf.latitude : null,
                longitude: typeof cf.longitude === 'number' ? cf.longitude : null,
            };
        });
    }

    /** 按 id 取单项（对话回显/确认卡用） */
    async getItem(ctx: RequestContext, customerId: string | number, addressId: string): Promise<AddressBookItem | null> {
        const items = await this.list(ctx, customerId);
        return items.find(a => a.id === addressId) ?? null;
    }

    /** 新增地址（setDefault=true 时 core 自动清旧默认）；返回新建地址 id，失败 null */
    async add(
        ctx: RequestContext,
        customerId: string | number,
        input: {
            streetLine1: string;
            phoneNumber: string;
            setDefault: boolean;
            fullName?: string;
            province?: string | null;
            city?: string | null;
            latitude?: number | null;
            longitude?: number | null;
        },
    ): Promise<string | null> {
        try {
            const address = await this.customerService.createAddress(ctx, customerId, {
                streetLine1: input.streetLine1.slice(0, 250),
                phoneNumber: input.phoneNumber,
                ...(input.fullName ? { fullName: input.fullName } : {}),
                ...(input.province ? { province: input.province } : {}),
                ...(input.city ? { city: input.city } : {}),
                countryCode: 'CN',
                defaultShippingAddress: input.setDefault,
                ...buildCoordinateFields(input.latitude, input.longitude),
            } as any);
            return String(address.id);
        } catch (e: any) {
            Logger.warn(`Assistant address add failed: ${e?.message}`, loggerCtx);
            return null;
        }
    }

    /** 改收货地址文本（可同步坐标：地理编码结果回写 latitude/longitude） */
    async updateText(
        ctx: RequestContext,
        addressId: string,
        text: string,
        geo?: { latitude?: number | null; longitude?: number | null; province?: string | null; city?: string | null },
    ): Promise<boolean> {
        try {
            await this.customerService.updateAddress(ctx, {
                id: addressId,
                streetLine1: text.slice(0, 250),
                ...(geo?.province ? { province: geo.province } : {}),
                ...(geo?.city ? { city: geo.city } : {}),
                ...buildCoordinateFields(geo?.latitude, geo?.longitude),
            } as any);
            return true;
        } catch (e: any) {
            Logger.warn(`Assistant address updateText failed: ${e?.message}`, loggerCtx);
            return false;
        }
    }

    /** 改收货人/电话（姓名可省略：只传电话即只改电话） */
    async updatePerson(
        ctx: RequestContext,
        addressId: string,
        input: { fullName?: string; phoneNumber?: string },
    ): Promise<boolean> {
        try {
            await this.customerService.updateAddress(ctx, {
                id: addressId,
                ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
                ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
            } as any);
            return true;
        } catch (e: any) {
            Logger.warn(`Assistant address updatePerson failed: ${e?.message}`, loggerCtx);
            return false;
        }
    }

    /**
     * 删除地址（core deleteAddress：删默认时剩余最早地址自动顶替）。
     * 调用方删除前先 getItem 记录 isDefault，删除后重新 list 判断新默认（供对话文案展示切换提示）。
     */
    async remove(ctx: RequestContext, addressId: string): Promise<boolean> {
        try {
            await this.customerService.deleteAddress(ctx, addressId as any);
            return true;
        } catch (e: any) {
            Logger.warn(`Assistant address remove failed: ${e?.message}`, loggerCtx);
            return false;
        }
    }

    /** 设为默认（core 自动清旧默认，顾客内唯一） */
    async setDefault(ctx: RequestContext, addressId: string): Promise<boolean> {
        try {
            await this.customerService.updateAddress(ctx, { id: addressId, defaultShippingAddress: true } as any);
            return true;
        } catch (e: any) {
            Logger.warn(`Assistant address setDefault failed: ${e?.message}`, loggerCtx);
            return false;
        }
    }
}

/**
 * Address 坐标自定义字段（delivery-plugin 已注册 latitude/longitude）。
 * 两者都有效才写入，避免半残坐标参与配送范围计算。
 */
function buildCoordinateFields(
    latitude?: number | null,
    longitude?: number | null,
): { customFields?: { latitude: number; longitude: number } } {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
    return { customFields: { latitude, longitude } };
}
