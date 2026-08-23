import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { PaymentProfile } from './payment-profile.entity';
import { PaymentProfileMethod } from './payment-profile-method.entity';

@Injectable()
export class PaymentProfileMigrationService {
    constructor(private connection: TransactionalConnection) {}

    /** 将档案级 installmentOptions 迁移到对应支付方式的 options */
    async migrateLegacyInstallmentOptions(ctx: RequestContext): Promise<void> {
        const repo = this.connection.getRepository(ctx, PaymentProfile);
        const jmRepo = this.connection.getRepository(ctx, PaymentProfileMethod);
        const profiles = await repo.find({ relations: ['paymentMethods'] });
        for (const p of profiles) {
            if (!p.installmentOptions) continue;
            const opts = { ...p.installmentOptions };
            for (const pm of p.paymentMethods ?? []) {
                const existing = await jmRepo.findOne({
                    where: { profileId: String(p.id), paymentMethodId: String(pm.id) },
                });
                if (existing) {
                    existing.options = opts;
                    await jmRepo.save(existing);
                } else {
                    await jmRepo.save(new PaymentProfileMethod({
                        profileId: String(p.id),
                        paymentMethodId: String(pm.id),
                        mode: 'installment',
                        options: opts,
                    } as any));
                }
            }
        }
    }
}