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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingProfileService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shipping_profile_entity_1 = require("./shipping-profile.entity");
const shipping_profile_method_entity_1 = require("./shipping-profile-method.entity");
const pickup_location_entity_1 = require("../pickup/pickup-location.entity");
let ShippingProfileService = class ShippingProfileService {
    constructor(connection) {
        this.connection = connection;
    }
    async findAll(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .createQueryBuilder('sp')
            .leftJoinAndSelect('sp.shippingMethods', 'sm')
            .leftJoinAndSelect('sp.pickupLocations', 'pl')
            .where('(sp.isGlobal = :isGlobal OR sp.ownerChannelId = :channelId)', {
            isGlobal: true,
            channelId: ctx.channelId,
        });
        if ((_b = (_a = options === null || options === void 0 ? void 0 : options.filter) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.contains) {
            qb.andWhere('sp.name LIKE :name', { name: `%${options.filter.name.contains}%` });
        }
        const skip = (options === null || options === void 0 ? void 0 : options.skip) || 0;
        const take = (options === null || options === void 0 ? void 0 : options.take) || 10;
        qb.skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOne(ctx, id) {
        const result = await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .findOne({ where: { id: id }, relations: ['shippingMethods', 'pickupLocations'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod)
                .find({ where: { profileId: String(result.id) } });
            result.methodConfigs = methodConfigs;
        }
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findByCode(ctx, code) {
        const result = await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .findOne({ where: { code }, relations: ['shippingMethods', 'pickupLocations'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod)
                .find({ where: { profileId: String(result.id) } });
            result.methodConfigs = methodConfigs;
        }
        return result !== null && result !== void 0 ? result : undefined;
    }
    async create(ctx, input) {
        var _a, _b, _c, _d;
        if (!((_a = input.shippingMethodIds) === null || _a === void 0 ? void 0 : _a.length)) {
            throw new core_1.UserInputError('配送档案至少需要选择一种配送方式');
        }
        const repo = this.connection.getRepository(ctx, shipping_profile_entity_1.ShippingProfile);
        const profile = new shipping_profile_entity_1.ShippingProfile(input);
        profile.channels = [ctx.channel];
        profile.ownerChannelId = input.isGlobal ? null : ctx.channelId;
        profile.isGlobal = (_b = input.isGlobal) !== null && _b !== void 0 ? _b : false;
        if ((_c = input.shippingMethodIds) === null || _c === void 0 ? void 0 : _c.length) {
            profile.shippingMethods = input.shippingMethodIds.map((id) => ({ id }));
        }
        // pickupLocations: undefined=不变, []=清空, [ids]=设置
        if (input.pickupLocationIds !== undefined) {
            profile.pickupLocations = input.pickupLocationIds.map((id) => ({ id }));
        }
        await repo.save(profile);
        if ((_d = input.methodConfigs) === null || _d === void 0 ? void 0 : _d.length) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        // reload 以填充关联实体的完整字段
        return (await repo.findOne({
            where: { id: profile.id },
            relations: ['shippingMethods', 'pickupLocations'],
        }));
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, shipping_profile_entity_1.ShippingProfile);
        const profile = await repo.findOne({
            where: { id: input.id },
            relations: ['shippingMethods', 'pickupLocations'],
        });
        if (!profile)
            throw new core_1.EntityNotFoundError('ShippingProfile', input.id);
        if (profile.isGlobal && !ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            throw new core_1.UserInputError('不能修改全局档案');
        }
        if (input.shippingMethodIds !== undefined) {
            if (input.shippingMethodIds.length === 0) {
                throw new core_1.UserInputError('配送档案至少需要选择一种配送方式');
            }
            profile.shippingMethods = input.shippingMethodIds.map((id) => ({ id }));
        }
        if (input.pickupLocationIds !== undefined) {
            profile.pickupLocations = input.pickupLocationIds.map((id) => ({ id }));
        }
        const { id, shippingMethodIds, pickupLocationIds } = input, updateData = __rest(input, ["id", "shippingMethodIds", "pickupLocationIds"]);
        Object.assign(profile, updateData);
        await repo.save(profile);
        if (input.methodConfigs !== undefined) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        return (await repo.findOne({
            where: { id: input.id },
            relations: ['shippingMethods', 'pickupLocations'],
        }));
    }
    async delete(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, shipping_profile_entity_1.ShippingProfile);
        const result = await repo.manager.query(`SELECT COUNT(*) as count FROM product_variant WHERE "customFieldsShippingprofileid" = $1`, [String(id)]);
        const count = parseInt(((_a = result === null || result === void 0 ? void 0 : result[0]) === null || _a === void 0 ? void 0 : _a.count) || '0', 10);
        if (count > 0) {
            throw new core_1.UserInputError(`有 ${count} 个商品引用此档案，请先重新分配`);
        }
        const profile = await repo.findOne({ where: { id: id } });
        if (!profile)
            throw new core_1.EntityNotFoundError('ShippingProfile', id);
        const jmRepo = this.connection.getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod);
        await jmRepo.delete({ profileId: String(id) });
        await repo.remove(profile);
    }
    async assignToVariants(ctx, variantIds, profileId) {
        const profile = await this.findOne(ctx, profileId);
        if (!profile)
            throw new core_1.EntityNotFoundError('ShippingProfile', profileId);
        const repo = this.connection.getRepository(ctx, 'ProductVariant');
        const ids = variantIds.map(id => Number(id));
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await repo.manager.query(`UPDATE product_variant SET "customFieldsShippingprofileid" = $1 WHERE id IN (${placeholders})`, [String(profileId), ...ids]);
    }
    async getIntersectedShippingMethods(ctx, profileIds) {
        var _a;
        if (profileIds.length === 0)
            return [];
        if (profileIds.length === 1) {
            const profile = await this.findOne(ctx, profileIds[0]);
            return ((_a = profile === null || profile === void 0 ? void 0 : profile.shippingMethods) !== null && _a !== void 0 ? _a : []).map(sm => ({ id: sm.id, code: sm.code }));
        }
        const qb = this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .createQueryBuilder('sp')
            .innerJoin('sp.shippingMethods', 'sm')
            .select('sm.id', 'id')
            .addSelect('sm.code', 'code')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .groupBy('sm.id')
            .addGroupBy('sm.code')
            .having('COUNT(DISTINCT sp.id) = :count', { count: profileIds.length });
        return qb.getRawMany();
    }
    /**
     * 按交集 id 查询完整 ShippingMethod 实体（供 Shop API 返回完整字段）
     * ShippingMethod 是 translatable 实体，需 join translations 加载 name
     */
    async findShippingMethodsByIds(ctx, ids) {
        if (ids.length === 0)
            return [];
        return this.connection
            .getRepository(ctx, 'ShippingMethod')
            .createQueryBuilder('sm')
            .leftJoinAndSelect('sm.translations', 't')
            .where('sm.id IN (:...ids)', { ids })
            .getMany();
    }
    /**
     * 获取多个 Profile 的自提点交集。
     * 规则：
     * - 任一 Profile 的 pickupLocations 为空（未约束）→ 视为该 Profile 不约束，跳过
     * - 所有约束了的 Profile 的 pickupLocations 取交集
     * - 若所有 Profile 都未约束，返回 null（表示不限制，前端展示全部自提点）
     * - 若交集为空但至少有一个约束，返回 []（表示无可用自提点）
     */
    async getIntersectedPickupLocations(ctx, profileIds) {
        if (profileIds.length === 0)
            return null;
        const profiles = await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .createQueryBuilder('sp')
            .leftJoinAndSelect('sp.pickupLocations', 'pl')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .getMany();
        // 按 Profile 分组：约束了的 vs 未约束的
        const constrained = profiles.filter(p => { var _a, _b; return ((_b = (_a = p.pickupLocations) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0; });
        if (constrained.length === 0)
            return null; // 全部未约束
        // 取交集
        let intersection = new Set(constrained[0].pickupLocations.map(pl => pl.id));
        for (let i = 1; i < constrained.length; i++) {
            const current = new Set(constrained[i].pickupLocations.map(pl => pl.id));
            intersection = new Set([...intersection].filter(x => current.has(x)));
        }
        return [...intersection];
    }
    /**
     * 查询是否任一 Profile 约束了自提点。
     * 前端用此区分 eligiblePickupLocationsByProfile 返回 [] 的两种情况：
     * - false → 未约束，前端展示全部自提点
     * - true  → 约束了但交集为空，前端展示"无可用自提点"
     */
    async hasPickupLocationConstraint(ctx, profileIds) {
        if (profileIds.length === 0)
            return false;
        const count = await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .createQueryBuilder('sp')
            .innerJoin('sp.pickupLocations', 'pl')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .getCount();
        return count > 0;
    }
    async findPickupLocationsByIds(ctx, ids) {
        if (ids.length === 0)
            return [];
        return this.connection
            .getRepository(ctx, pickup_location_entity_1.PickupLocation)
            .findByIds(ids);
    }
    async replaceMethodConfigs(ctx, profileId, configs) {
        var _a, _b;
        const jmRepo = this.connection.getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod);
        await jmRepo.delete({ profileId: String(profileId) });
        for (const cfg of configs) {
            await jmRepo.save(new shipping_profile_method_entity_1.ShippingProfileMethod({
                profileId: String(profileId),
                shippingMethodId: String(cfg.shippingMethodId),
                mode: (_a = cfg.mode) !== null && _a !== void 0 ? _a : 'mail',
                options: (_b = cfg.options) !== null && _b !== void 0 ? _b : null,
            }));
        }
    }
    async setTenantDefault(ctx, id) {
        const repo = this.connection.getRepository(ctx, shipping_profile_entity_1.ShippingProfile);
        const profile = await repo.findOne({ where: { id: id } });
        if (!profile)
            throw new core_1.UserInputError('档案不存在');
        if (profile.isGlobal)
            throw new core_1.UserInputError('全局档案不能设为租户默认');
        await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .createQueryBuilder()
            .update()
            .set({ isTenantDefault: false })
            .where('"ownerChannelId" = :channelId AND "isGlobal" = false', { channelId: ctx.channelId })
            .execute();
        profile.isTenantDefault = true;
        await repo.save(profile);
    }
    async getTenantDefault(ctx) {
        const profile = await this.connection
            .getRepository(ctx, shipping_profile_entity_1.ShippingProfile)
            .findOne({ where: { isGlobal: false, ownerChannelId: ctx.channelId, isTenantDefault: true } });
        return profile !== null && profile !== void 0 ? profile : undefined;
    }
    async getMethodConfigsByProfile(ctx, profileId) {
        return this.connection
            .getRepository(ctx, shipping_profile_method_entity_1.ShippingProfileMethod)
            .find({ where: { profileId: String(profileId) } });
    }
};
exports.ShippingProfileService = ShippingProfileService;
exports.ShippingProfileService = ShippingProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ShippingProfileService);
//# sourceMappingURL=shipping-profile.service.js.map