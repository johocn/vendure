import { ID, TransactionalConnection } from '@vendure/core';
import { VariantLocationBinding } from './variant-location-binding.entity';
export declare class VariantLocationBindingService {
    private connection;
    constructor(connection: TransactionalConnection);
    findByVariant(variantId: ID): Promise<VariantLocationBinding[]>;
    findByVariants(variantIds: ID[]): Promise<VariantLocationBinding[]>;
}
