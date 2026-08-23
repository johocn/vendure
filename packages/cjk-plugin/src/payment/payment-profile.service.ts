import { Injectable } from '@nestjs/common';
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
import { PaymentProfile } from './payment-profile.entity';
import { PaymentProfileMethod } from './payment-profile-method.entity';

@Injectable()
export class PaymentProfileService {
    constructor(private connection: TransactionalConnection) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<PaymentProfile>,
    ): Promise<PaginatedList<PaymentProfile>> {
        const qb = this.connection
            .getRepository(ctx, PaymentProfile)
            .createQueryBuilder('pp')
            .leftJoinAndSelect('pp.paymentMethods', 'pm')
            .where('(pp.isGlobal = :isGlobal OR pp.ownerChannelId = :channelId)', {
                isGlobal: true,
                channelId: ctx.channelId,
            });
        if (options?.filter?.name?.contains) {
            qb.andWhere('pp.name LIKE :name', { name: `%${options.filter.name.contains}%` });
        }
        const skip = options?.skip || 0;
        const take = options?.take || 10;
        qb.skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOne(ctx: RequestContext, id: ID): Promise<PaymentProfile | undefined> {
        const result = await this.connection
            .getRepository(ctx, PaymentProfile)
            .findOne({ where: { id: id as any }, relations: ['paymentMethods'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, PaymentProfileMethod)
                .find({ where: { profileId: String(result.id) } as any });
            (result as any).methodConfigs = methodConfigs;
        }
        return result ?? undefined;
    }

    async findByCode(ctx: RequestContext, code: string): Promise<PaymentProfile | undefined> {
        const result = await this.connection
            .getRepository(ctx, PaymentProfile)
            .findOne({ where: { code }, relations: ['paymentMethods'] });
        if (result) {
            const methodConfigs = await this.connection
                .getRepository(ctx, PaymentProfileMethod)
                .find({ where: { profileId: String(result.id) } as any });
            (result as any).methodConfigs = methodConfigs;
        }
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: any): Promise<PaymentProfile> {
        if (!input.paymentMethodIds?.length) {
            throw new UserInputError('支付档案至少需要选择一种支付方式');
        }
        const repo = this.connection.getRepository(ctx, PaymentProfile);
        const profile = new PaymentProfile(input);
        profile.channels = [ctx.channel];
        profile.ownerChannelId = input.isGlobal ? null : ctx.channelId;
        profile.isGlobal = input.isGlobal ?? false;
        if (input.paymentMethodIds?.length) {
            profile.paymentMethods = input.paymentMethodIds.map((id: ID) => ({ id } as any));
        }
        await repo.save(profile);
        if (input.methodConfigs?.length) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        // reload 以填充关联实体完整字段并挂 methodConfigs
        return (await this.findOne(ctx, profile.id)) as PaymentProfile;
    }

    async update(ctx: RequestContext, input: any): Promise<PaymentProfile> {
        const repo = this.connection.getRepository(ctx, PaymentProfile);
        const profile = await repo.findOne({
            where: { id: input.id },
            relations: ['paymentMethods'],
        });
        if (!profile) throw new EntityNotFoundError('PaymentProfile', input.id);
        if (profile.isGlobal && !ctx.userHasPermissions([Permission.SuperAdmin])) {
            throw new UserInputError('不能修改全局档案');
        }
        if (input.paymentMethodIds !== undefined) {
            if (input.paymentMethodIds.length === 0) {
                throw new UserInputError('支付档案至少需要选择一种支付方式');
            }
            profile.paymentMethods = input.paymentMethodIds.map((id: ID) => ({ id } as any));
        }
        const { id, paymentMethodIds, ...updateData } = input;
        Object.assign(profile, updateData);
        await repo.save(profile);
        if (input.methodConfigs !== undefined) {
            await this.replaceMethodConfigs(ctx, profile.id, input.methodConfigs);
        }
        return (await this.findOne(ctx, profile.id)) as PaymentProfile;
    }

    async delete(ctx: RequestContext, id: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, PaymentProfile);
        const result = await repo.manager.query(
            `SELECT COUNT(*) as count FROM product_variant WHERE "customFieldsPaymentprofileid" = $1`,
            [String(id)]
        );
        const count = parseInt(result?.[0]?.count || '0', 10);
        if (count > 0) {
            throw new UserInputError(`有 ${count} 个商品引用此档案，请先重新分配`);
        }
        const profile = await repo.findOne({ where: { id: id as any } });
        if (!profile) throw new EntityNotFoundError('PaymentProfile', id);
        const jmRepo = this.connection.getRepository(ctx, PaymentProfileMethod);
        await jmRepo.delete({ profileId: String(id) } as any);
        await repo.remove(profile);
    }

    async assignToVariants(
        ctx: RequestContext,
        variantIds: ID[],
        profileId: ID,
    ): Promise<void> {
        const profile = await this.findOne(ctx, profileId);
        if (!profile) throw new EntityNotFoundError('PaymentProfile', profileId);
        const repo = this.connection.getRepository(ctx, 'ProductVariant');
        const ids = variantIds.map(id => Number(id));
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await repo.manager.query(
            `UPDATE product_variant SET "customFieldsPaymentprofileid" = $1 WHERE id IN (${placeholders})`,
            [String(profileId), ...ids]
        );
    }

    async getIntersectedPaymentMethods(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<Array<{ id: ID; code: string }>> {
        if (profileIds.length === 0) return [];
        if (profileIds.length === 1) {
            const profile = await this.findOne(ctx, profileIds[0]);
            return (profile?.paymentMethods ?? []).map(pm => ({ id: pm.id, code: pm.code }));
        }
        const qb = this.connection
            .getRepository(ctx, PaymentProfile)
            .createQueryBuilder('pp')
            .innerJoin('pp.paymentMethods', 'pm')
            .select('pm.id', 'id')
            .addSelect('pm.code', 'code')
            .where('pp.id IN (:...profileIds)', { profileIds })
            .groupBy('pm.id')
            .addGroupBy('pm.code')
            .having('COUNT(DISTINCT pp.id) = :count', { count: profileIds.length });
        return qb.getRawMany();
    }

    /**
     * 按交集 id 查询完整 PaymentMethod 实体（供 Shop API 返回完整字段）
     * PaymentMethod 是 translatable 实体，需 join translations 加载 name
     */
    async findPaymentMethodsByIds(ctx: RequestContext, ids: ID[]): Promise<any[]> {
        if (ids.length === 0) return [];
        return this.connection
            .getRepository(ctx, 'PaymentMethod')
            .createQueryBuilder('pm')
            .leftJoinAndSelect('pm.translations', 't')
            .where('pm.id IN (:...ids)', { ids })
            .getMany();
    }

    async getIntersectedInstallmentOptions(
        ctx: RequestContext,
        profileIds: ID[],
    ): Promise<Record<string, any> | null> {
        if (profileIds.length === 0) return null;
        const profiles = await this.connection
            .getRepository(ctx, PaymentProfile)
            .find({ where: { id: profileIds as any } as any });
        const profilesWithInstallment = profiles.filter(p => p.installmentOptions);
        if (profilesWithInstallment.length === 0) return null;

        const result: Record<string, any> = {};
        for (const provider of ['alipay', 'wechatpay']) {
            const allPeriods = profilesWithInstallment
                .filter(p => p.installmentOptions?.[provider]?.huabei?.periods)
                .map(p => (p.installmentOptions as any)[provider].huabei.periods);
            if (allPeriods.length < profilesWithInstallment.length) continue;
            const intersected = allPeriods.reduce((a: any[], b: any[]) => a.filter(v => b.includes(v)));
            if (intersected.length > 0) {
                result[provider] = { huabei: { periods: intersected } };
            }
        }
        return Object.keys(result).length > 0 ? result : null;
    }

    private async replaceMethodConfigs(
        ctx: RequestContext,
        profileId: any,
        configs: Array<{ paymentMethodId: any; mode?: string; options?: any }>,
    ): Promise<void> {
        const jmRepo = this.connection.getRepository(ctx, PaymentProfileMethod);
        await jmRepo.delete({ profileId: String(profileId) } as any);
        for (const cfg of configs) {
            await jmRepo.save(new PaymentProfileMethod({
                profileId: String(profileId),
                paymentMethodId: String(cfg.paymentMethodId),
                mode: cfg.mode ?? 'installment',
                options: cfg.options ?? null,
            } as any));
        }
    }

    async setTenantDefault(ctx: RequestContext, id: any): Promise<void> {
        const repo = this.connection.getRepository(ctx, PaymentProfile);
        const profile = await repo.findOne({ where: { id: id as any } });
        if (!profile) throw new UserInputError('档案不存在');
        if (profile.isGlobal) throw new UserInputError('全局档案不能设为租户默认');
        await this.connection
            .getRepository(ctx, PaymentProfile)
            .createQueryBuilder()
            .update()
            .set({ isTenantDefault: false })
            .where('"ownerChannelId" = :channelId AND "isGlobal" = false', { channelId: ctx.channelId })
            .execute();
        profile.isTenantDefault = true;
        await repo.save(profile);
    }

    async getTenantDefault(ctx: RequestContext): Promise<PaymentProfile | undefined> {
        const profile = await this.connection
            .getRepository(ctx, PaymentProfile)
            .findOne({ where: { isGlobal: false, ownerChannelId: ctx.channelId as any, isTenantDefault: true } });
        return profile ?? undefined;
    }

    async getMethodConfigsByProfile(ctx: RequestContext, profileId: any): Promise<any[]> {
        return this.connection
            .getRepository(ctx, PaymentProfileMethod)
            .find({ where: { profileId: String(profileId) } as any });
    }
}