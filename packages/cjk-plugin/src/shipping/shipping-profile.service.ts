import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
    EntityNotFoundError,
    ID,
    ListQueryOptions,
    PaginatedList,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { ShippingProfile } from './shipping-profile.entity';
import { ShippingProfileMethod } from './shipping-profile-method.entity';
import { PickupLocation } from '../pickup/pickup-location.entity';

@Injectable()
export class ShippingProfileService {
    constructor(private connection: TransactionalConnection) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<ShippingProfile>,
    ): Promise<PaginatedList<ShippingProfile>> {
        const qb = this.connection
            .getRepository(ctx, ShippingProfile)
            .createQueryBuilder('sp')
            .leftJoinAndSelect('sp.shippingMethods', 'sm')
            .leftJoinAndSelect('sp.pickupLocations', 'pl')
            .where('(sp.isGlobal = :isGlobal OR sp.ownerChannelId = :channelId)', {
                isGlobal: true,
                channelId: ctx.channelId,
            });
        if (options?.filter?.name?.contains) {
            qb.andWhere('sp.name LIKE :name', { name: `%${options.filter.name.contains}%` });
        }
        const skip = options?.skip || 0;
        const take = options?.take || 10;
        qb.skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        await this.attachMethodConfigs(ctx, items);
        return { items, totalItems };
    }

    async findOne(ctx: RequestContext, id: any): Promise<ShippingProfile | undefined> {
        const result = await this.connection
            .getRepository(ctx, ShippingProfile)
            .findOne({ where: { id: id as any }, relations: ['shippingMethods', 'pickupLocations'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, ShippingProfileMethod)
                .find({ where: { profileId: String(result.id) } as any });
            (result as any).methodConfigs = methodConfigs;
        }
        return result ?? undefined;
    }

    async findByCode(ctx: RequestContext, code: string): Promise<ShippingProfile | undefined> {
        const result = await this.connection
            .getRepository(ctx, ShippingProfile)
            .findOne({ where: { code }, relations: ['shippingMethods', 'pickupLocations'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, ShippingProfileMethod)
                .find({ where: { profileId: String(result.id) } as any });
            (result as any).methodConfigs = methodConfigs;
        }
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: any): Promise<ShippingProfile> {
        if (!input.shippingMethodIds?.length) {
            throw new UserInputError('配送档案至少需要选择一种配送方式');
        }
        const repo = this.connection.getRepository(ctx, ShippingProfile);
        const profile = new ShippingProfile(input);
        profile.channels = [ctx.channel];
        profile.ownerChannelId = input.isGlobal ? null : ctx.channelId;
        profile.isGlobal = input.isGlobal ?? false;
        if (input.shippingMethodIds?.length) {
            profile.shippingMethods = input.shippingMethodIds.map((id: ID) => ({ id } as any));
        }
        // pickupLocations: undefined=不变, []=清空, [ids]=设置
        if (input.pickupLocationIds !== undefined) {
            profile.pickupLocations = input.pickupLocationIds.map((id: ID) => ({ id } as any));
        }
        await repo.save(profile);
        if (input.methodConfigs?.length) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        // reload 以填充关联实体的完整字段
        return (await repo.findOne({
            where: { id: profile.id as any },
            relations: ['shippingMethods', 'pickupLocations'],
        })) as ShippingProfile;
    }

    async update(ctx: RequestContext, input: any): Promise<ShippingProfile> {
        const repo = this.connection.getRepository(ctx, ShippingProfile);
        const profile = await repo.findOne({
            where: { id: input.id },
            relations: ['shippingMethods', 'pickupLocations'],
        });
        if (!profile) throw new EntityNotFoundError('ShippingProfile', input.id);
        if (profile.isGlobal && !ctx.userHasPermissions([Permission.SuperAdmin])) {
            throw new UserInputError('不能修改全局档案');
        }
        if (input.shippingMethodIds !== undefined) {
            if (input.shippingMethodIds.length === 0) {
                throw new UserInputError('配送档案至少需要选择一种配送方式');
            }
            profile.shippingMethods = input.shippingMethodIds.map((id: ID) => ({ id } as any));
        }
        if (input.pickupLocationIds !== undefined) {
            profile.pickupLocations = input.pickupLocationIds.map((id: ID) => ({ id } as any));
        }
        const { id, shippingMethodIds, pickupLocationIds, ...updateData } = input;
        Object.assign(profile, updateData);
        await repo.save(profile);
        if (input.methodConfigs !== undefined) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        return (await repo.findOne({
            where: { id: input.id as any },
            relations: ['shippingMethods', 'pickupLocations'],
        })) as ShippingProfile;
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, ShippingProfile);
        const result = await repo.manager.query(
            `SELECT COUNT(*) as count FROM product_variant WHERE "customFieldsShippingprofileid" = $1`,
            [String(id)]
        );
        const count = parseInt(result?.[0]?.count || '0', 10);
        if (count > 0) {
            throw new UserInputError(`有 ${count} 个商品引用此档案，请先重新分配`);
        }
        const profile = await repo.findOne({ where: { id: id as any } });
        if (!profile) throw new EntityNotFoundError('ShippingProfile', id);
        const jmRepo = this.connection.getRepository(ctx, ShippingProfileMethod);
        await jmRepo.delete({ profileId: String(id) } as any);
        await repo.remove(profile);
    }

    async assignToVariants(
        ctx: RequestContext,
        variantIds: ID[],
        profileId: ID,
    ): Promise<void> {
        const profile = await this.findOne(ctx, profileId);
        if (!profile) throw new EntityNotFoundError('ShippingProfile', profileId);
        const repo = this.connection.getRepository(ctx, 'ProductVariant');
        const ids = variantIds.map(id => Number(id));
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await repo.manager.query(
            `UPDATE product_variant SET "customFieldsShippingprofileid" = $1 WHERE id IN (${placeholders})`,
            [String(profileId), ...ids]
        );
    }

    async getIntersectedShippingMethods(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<Array<{ id: ID; code: string }>> {
        if (profileIds.length === 0) return [];
        if (profileIds.length === 1) {
            const profile = await this.findOne(ctx, profileIds[0]);
            return (profile?.shippingMethods ?? []).map(sm => ({ id: sm.id, code: sm.code }));
        }
        const qb = this.connection
            .getRepository(ctx, ShippingProfile)
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
    async findShippingMethodsByIds(ctx: RequestContext, ids: ID[]): Promise<any[]> {
        if (ids.length === 0) return [];
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
    async getIntersectedPickupLocations(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<ID[] | null> {
        if (profileIds.length === 0) return null;
        const profiles = await this.connection
            .getRepository(ctx, ShippingProfile)
            .createQueryBuilder('sp')
            .leftJoinAndSelect('sp.pickupLocations', 'pl')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .getMany();

        // 按 Profile 分组：约束了的 vs 未约束的
        const constrained = profiles.filter(p => (p.pickupLocations?.length ?? 0) > 0);
        if (constrained.length === 0) return null; // 全部未约束

        // 取交集
        let intersection = new Set(constrained[0].pickupLocations.map(pl => pl.id));
        for (let i = 1; i < constrained.length; i++) {
            const current = new Set(constrained[i].pickupLocations.map(pl => pl.id));
            intersection = new Set([...intersection].filter(x => current.has(x as any)));
        }
        return [...intersection] as ID[];
    }

    /**
     * 结合 per-method config 的自提点取 Profile 交集。
     * 规则：Profile 的 methodConfigs 中有 mode==='pickup' 且带 pickupLocationIds 时，
     * 以其 config 中的自提点作为该 Profile 的约束；否则回退到档案级 pickupLocations。
     * 其余语义与 getIntersectedPickupLocations 一致：
     * - 全部未约束 → null；有约束但交集为空 → []。
     */
    async getIntersectedPickupLocationsWithConfig(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<ID[] | null> {
        if (profileIds.length === 0) return null;
        const profiles = await this.connection
            .getRepository(ctx, ShippingProfile)
            .createQueryBuilder('sp')
            .leftJoinAndSelect('sp.pickupLocations', 'pl')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .getMany();

        const effectiveByProfile: ID[][] = [];
        for (const profile of profiles) {
            const configs = await this.getMethodConfigsByProfile(ctx, profile.id);
            const pickupConfigIds = configs
                .filter(c => c.mode === 'pickup' && c.options?.pickupLocationIds?.length)
                .flatMap(c => c.options.pickupLocationIds as ID[]);
            const effective = pickupConfigIds.length > 0
                ? pickupConfigIds
                : (profile.pickupLocations ?? []).map(pl => pl.id);
            effectiveByProfile.push(effective);
        }

        const constrained = effectiveByProfile.filter(ids => ids.length > 0);
        if (constrained.length === 0) return null; // 全部未约束

        let intersection = new Set(constrained[0]);
        for (let i = 1; i < constrained.length; i++) {
            const current = new Set(constrained[i]);
            intersection = new Set([...intersection].filter(x => current.has(x as any)));
        }
        return [...intersection] as ID[];
    }

    /**
     * 查询是否任一 Profile 约束了自提点。
     * 前端用此区分 eligiblePickupLocationsByProfile 返回 [] 的两种情况：
     * - false → 未约束，前端展示全部自提点
     * - true  → 约束了但交集为空，前端展示"无可用自提点"
     */
    async hasPickupLocationConstraint(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<boolean> {
        if (profileIds.length === 0) return false;
        const count = await this.connection
            .getRepository(ctx, ShippingProfile)
            .createQueryBuilder('sp')
            .innerJoin('sp.pickupLocations', 'pl')
            .where('sp.id IN (:...profileIds)', { profileIds })
            .getCount();
        return count > 0;
    }

    async findPickupLocationsByIds(
        ctx: RequestContext,
        ids: ID[],
    ): Promise<PickupLocation[]> {
        if (ids.length === 0) return [];
        return this.connection
            .getRepository(ctx, PickupLocation)
            .findByIds(ids as any);
    }

    private async replaceMethodConfigs(
        ctx: RequestContext,
        profileId: any,
        configs: Array<{ shippingMethodId: any; mode?: string; options?: any }>,
    ): Promise<void> {
        const jmRepo = this.connection.getRepository(ctx, ShippingProfileMethod);
        await jmRepo.delete({ profileId: String(profileId) } as any);
        for (const cfg of configs) {
            await jmRepo.save(new ShippingProfileMethod({
                profileId: String(profileId),
                shippingMethodId: String(cfg.shippingMethodId),
                mode: cfg.mode ?? 'mail',
                options: cfg.options ?? null,
            } as any));
        }
    }

    async setTenantDefault(ctx: RequestContext, id: any): Promise<void> {
        const repo = this.connection.getRepository(ctx, ShippingProfile);
        const profile = await repo.findOne({ where: { id: id as any } });
        if (!profile) throw new UserInputError('档案不存在');
        if (profile.isGlobal) throw new UserInputError('全局档案不能设为租户默认');
        await this.connection
            .getRepository(ctx, ShippingProfile)
            .createQueryBuilder()
            .update()
            .set({ isTenantDefault: false })
            .where('"ownerChannelId" = :channelId AND "isGlobal" = false', { channelId: ctx.channelId })
            .execute();
        profile.isTenantDefault = true;
        await repo.save(profile);
    }

    async getTenantDefault(ctx: RequestContext): Promise<ShippingProfile | undefined> {
        const profile = await this.connection
            .getRepository(ctx, ShippingProfile)
            .findOne({
                where: { isGlobal: false, ownerChannelId: ctx.channelId as any, isTenantDefault: true },
                relations: ['shippingMethods', 'pickupLocations'],
            });
        return profile ?? undefined;
    }

    async getMethodConfigsByProfile(ctx: RequestContext, profileId: any): Promise<any[]> {
        return this.connection
            .getRepository(ctx, ShippingProfileMethod)
            .find({ where: { profileId: String(profileId) } as any });
    }

    /**
     * 为列表查询批量填充 methodConfigs，避免 schema 非空字段返回 null 导致查询整体失败。
     */
    private async attachMethodConfigs(ctx: RequestContext, items: ShippingProfile[]): Promise<void> {
        if (!items.length) return;
        const ids = items.map(i => String(i.id));
        const rows = await this.connection
            .getRepository(ctx, ShippingProfileMethod)
            .find({ where: { profileId: In(ids) } as any });
        const byProfile = new Map<string, ShippingProfileMethod[]>();
        for (const r of rows) {
            const k = r.profileId;
            if (!byProfile.has(k)) byProfile.set(k, []);
            byProfile.get(k)!.push(r);
        }
        for (const item of items) {
            (item as any).methodConfigs = byProfile.get(String(item.id)) ?? [];
        }
    }
}