import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { ShippingProfile } from './shipping-profile.entity';
import { ShippingProfileMethod } from './shipping-profile-method.entity';

@Injectable()
export class ShippingProfileMigrationService {
    constructor(private connection: TransactionalConnection) {}

    /** 将档案级 pickupLocations 迁移到对应自提方式的 options.pickupLocationIds */
    async migrateLegacyPickupLocations(ctx: RequestContext): Promise<void> {
        const repo = this.connection.getRepository(ctx, ShippingProfile);
        const jmRepo = this.connection.getRepository(ctx, ShippingProfileMethod);
        const profiles = await repo.find({ relations: ['shippingMethods', 'pickupLocations'] });
        for (const p of profiles) {
            if (!p.pickupLocations?.length) continue;
            const pickupMethod = p.shippingMethods?.find(
                (m) => /pickup|store/i.test((m as any)?.code ?? ''),
            );
            if (!pickupMethod) continue;
            const options = { pickupLocationIds: p.pickupLocations.map((l) => String(l.id)) };
            const existing = await jmRepo.findOne({
                where: { profileId: String(p.id), shippingMethodId: String(pickupMethod.id) },
            });
            if (existing) {
                existing.options = options;
                await jmRepo.save(existing);
            } else {
                await jmRepo.save(new ShippingProfileMethod({
                    profileId: String(p.id),
                    shippingMethodId: String(pickupMethod.id),
                    mode: 'pickup',
                    options,
                } as any));
            }
        }
    }
}