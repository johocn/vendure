import { Injectable } from '@nestjs/common';
import { ID, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';
import { VariantLocationBinding } from './variant-location-binding.entity';

@Injectable()
export class VariantLocationBindingService {
    constructor(private connection: TransactionalConnection) {}

    findByVariant(variantId: ID): Promise<VariantLocationBinding[]> {
        return this.connection
            .getRepository(undefined as any, VariantLocationBinding)
            .find({ where: { variantId: variantId as any } });
    }

    findByVariants(variantIds: ID[]): Promise<VariantLocationBinding[]> {
        return this.connection
            .getRepository(undefined as any, VariantLocationBinding)
            .find({ where: { variantId: In(variantIds.map(String)) } });
    }
}
