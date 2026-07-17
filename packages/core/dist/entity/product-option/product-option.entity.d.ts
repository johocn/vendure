import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { ChannelAware, SoftDeletable } from '../../common/types/common-types';
import { LocaleString, Translatable, Translation } from '../../common/types/locale-types';
import { HasCustomFields } from '../../config/custom-field/custom-field-types';
import { VendureEntity } from '../base/base.entity';
import { Channel } from '../channel/channel.entity';
import { CustomProductOptionFields } from '../custom-entity-fields';
import { ProductOptionGroup } from '../product-option-group/product-option-group.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
/**
 * @description
 * A ProductOption is used to differentiate {@link ProductVariant}s from one another.
 *
 * @docsCategory entities
 */
export declare class ProductOption extends VendureEntity implements Translatable, HasCustomFields, SoftDeletable, ChannelAware {
    constructor(input?: DeepPartial<ProductOption>);
    deletedAt: Date | null;
    name: LocaleString;
    code: string;
    translations: Array<Translation<ProductOption>>;
    group: ProductOptionGroup;
    groupId: ID;
    productVariants: ProductVariant[];
    channels: Channel[];
    customFields: CustomProductOptionFields;
}
