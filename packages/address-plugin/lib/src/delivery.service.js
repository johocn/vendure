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
exports.DeliveryService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const delivery_address_entity_1 = require("./delivery-address.entity");
const delivery_range_entity_1 = require("./delivery-range.entity");
const shipping_rules_1 = require("./shipping-rules");
let DeliveryService = class DeliveryService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    /** 当前登录顾客；未登录抛 Unauthorized，无顾客抛 NotFound（对齐 review 口径）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    // ---------- 收货地址簿 ----------
    async listMyAddresses(ctx) {
        const customer = await this.requireCustomer(ctx);
        return this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress).find({
            where: { customerId: customer.id, channelId: ctx.channelId },
            order: { id: 'ASC' },
        });
    }
    async createAddress(ctx, input) {
        const customer = await this.requireCustomer(ctx);
        const count = await this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress).count({
            where: { customerId: customer.id, channelId: ctx.channelId },
        });
        const addr = new delivery_address_entity_1.DeliveryAddress(Object.assign(Object.assign({}, input), { customerId: customer.id, isDefault: count === 0 ? true : false, channelId: ctx.channelId }));
        return this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress).save(addr);
    }
    async getAddress(ctx, id) {
        const customer = await this.requireCustomer(ctx);
        const addr = await this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress).findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!addr) {
            throw new core_1.EntityNotFoundError('DeliveryAddress', id);
        }
        return addr;
    }
    async updateAddress(ctx, id, input) {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress);
        const addr = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!addr) {
            throw new core_1.EntityNotFoundError('DeliveryAddress', id);
        }
        Object.assign(addr, input);
        return repo.save(addr);
    }
    async deleteAddress(ctx, id) {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress);
        const addr = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!addr) {
            throw new core_1.EntityNotFoundError('DeliveryAddress', id);
        }
        await repo.remove(addr);
        return true;
    }
    /** 设为默认：事务内先清空该顾客全部默认，再置目标为默认（保证唯一）。 */
    async setDefaultAddress(ctx, id) {
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, delivery_address_entity_1.DeliveryAddress);
        const target = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!target) {
            throw new core_1.EntityNotFoundError('DeliveryAddress', id);
        }
        await this.connection.withTransaction(ctx, async (txCtx) => {
            const rp = this.connection.getRepository(txCtx, delivery_address_entity_1.DeliveryAddress);
            const mine = await rp.find({
                where: { customerId: customer.id, channelId: ctx.channelId },
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
    async requireShop(ctx, shopId) {
        const shop = await this.connection
            .getRepository(ctx, shop_plugin_1.Shop)
            .findOne({ where: { id: Number(shopId) } });
        if (!shop) {
            throw new core_1.EntityNotFoundError('Shop', shopId);
        }
    }
    async getRange(ctx, shopId) {
        return this.connection.getRepository(ctx, delivery_range_entity_1.DeliveryRange).findOne({
            where: { shopId: Number(shopId), channelId: ctx.channelId },
        });
    }
    /** 每店每渠道单档 upsert：存在则 update，否则 insert（幂等）。 */
    async upsertRange(ctx, input) {
        var _a, _b;
        await this.requireShop(ctx, input.shopId);
        const repo = this.connection.getRepository(ctx, delivery_range_entity_1.DeliveryRange);
        let range = await repo.findOne({
            where: { shopId: Number(input.shopId), channelId: ctx.channelId },
        });
        if (!range) {
            range = new delivery_range_entity_1.DeliveryRange({
                shopId: Number(input.shopId),
                channelId: ctx.channelId,
            });
        }
        if (input.enabled !== undefined)
            range.enabled = input.enabled;
        if (input.rangeType !== undefined)
            range.rangeType = input.rangeType;
        if (input.centerLng !== undefined)
            range.centerLng = input.centerLng;
        if (input.centerLat !== undefined)
            range.centerLat = input.centerLat;
        if (input.radiusKm !== undefined)
            range.radiusKm = input.radiusKm;
        if (input.districtCodes !== undefined) {
            range.districtCodes = input.districtCodes ? JSON.stringify(input.districtCodes) : null;
        }
        if (input.baseFee !== undefined)
            range.baseFee = (_a = input.baseFee) !== null && _a !== void 0 ? _a : 0;
        if (input.freeThreshold !== undefined)
            range.freeThreshold = (_b = input.freeThreshold) !== null && _b !== void 0 ? _b : null;
        return repo.save(range);
    }
    // ---------- 配送校验 ----------
    async validateDelivery(ctx, address, shopIds) {
        const results = [];
        for (const shopId of shopIds) {
            const range = await this.getRange(ctx, shopId);
            results.push(this.evaluateRange(range, shopId, address));
        }
        return results;
    }
    // ---------- 订单运费联动 ----------
    /** 当前订单行所属商品去重后的 shopId 列表（沿 Product.shopId 反查）。 */
    async getOrderShopIds(ctx, order) {
        const map = await (0, shipping_rules_1.resolveOrderShopMap)(this.connection, ctx, order);
        return [...new Set(map.values())];
    }
    /** 读取订单当前收件码/经纬度并逐店校验可得性。 */
    async evaluateOrderDelivery(ctx, order, shopIds) {
        const ids = shopIds !== null && shopIds !== void 0 ? shopIds : (await this.getOrderShopIds(ctx, order));
        const addr = (0, shipping_rules_1.readOrderShippingCodes)(order);
        return this.validateDelivery(ctx, addr, ids);
    }
    /** 是否已具备收件码可参与校验。 */
    hasOrderShippingCodes(order) {
        return (0, shipping_rules_1.hasOrderShippingCodes)(order);
    }
    /** 从地址簿写入订单收件码/经纬度（stage22 前置：setOrderShippingFromAddress）。 */
    applyAddressToOrderShipping(order, address) {
        var _a, _b, _c, _d, _e, _f;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        cf.shippingProvinceCode = (_b = address.provinceCode) !== null && _b !== void 0 ? _b : null;
        cf.shippingCityCode = (_c = address.cityCode) !== null && _c !== void 0 ? _c : null;
        cf.shippingDistrictCode = (_d = address.districtCode) !== null && _d !== void 0 ? _d : null;
        cf.shippingLng = (_e = address.lng) !== null && _e !== void 0 ? _e : null;
        cf.shippingLat = (_f = address.lat) !== null && _f !== void 0 ? _f : null;
        order.customFields = cf;
    }
    evaluateRange(range, shopId, addr) {
        var _a, _b, _c;
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
            const d = this.haversineKm((_a = range.centerLat) !== null && _a !== void 0 ? _a : 0, (_b = range.centerLng) !== null && _b !== void 0 ? _b : 0, addr.lat, addr.lng);
            if (d <= ((_c = range.radiusKm) !== null && _c !== void 0 ? _c : 0)) {
                return { shopId, inRange: true, reason: 'OK' };
            }
            return { shopId, inRange: false, reason: 'BEYOND_RANGE' };
        }
        if (range.rangeType === 'district') {
            const whitelist = this.parseDistrictCodes(range.districtCodes);
            const has = [addr.districtCode, addr.cityCode, addr.provinceCode].some(code => code != null && whitelist.has(code));
            if (has) {
                return { shopId, inRange: true, reason: 'OK' };
            }
            return { shopId, inRange: false, reason: 'NOT_IN_RANGE' };
        }
        return { shopId, inRange: false, reason: 'UNKNOWN_TYPE' };
    }
    parseDistrictCodes(raw) {
        if (!raw) {
            return new Set();
        }
        try {
            return new Set(JSON.parse(raw));
        }
        catch (_a) {
            return new Set();
        }
    }
    /** 大地距离（km），haversine 公式。 */
    haversineKm(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
};
exports.DeliveryService = DeliveryService;
exports.DeliveryService = DeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService])
], DeliveryService);
//# sourceMappingURL=delivery.service.js.map