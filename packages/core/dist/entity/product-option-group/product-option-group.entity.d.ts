import { DeepPartial } from '@vendure/common/lib/shared-types';
import { ChannelAware, SoftDeletable } from '../../common/types/common-types';
import { LocaleString, Translatable, Translation } from '../../common/types/locale-types';
import { HasCustomFields } from '../../config/custom-field/custom-field-types';
import { VendureEntity } from '../base/base.entity';
import { Channel } from '../channel/channel.entity';
import { CustomProductOptionGroupFields } from '../custom-entity-fields';
import { ProductOption } from '../product-option/product-option.entity';
import { Product } from '../product/product.entity';
/**
 * @description
 * A grouping of one or more {@link ProductOption}s.
 *
 * @docsCategory entities
 */
export declare class ProductOptionGroup extends VendureEntity implements Translatable, HasCustomFields, SoftDeletable, ChannelAware {
    constructor(input?: DeepPartial<ProductOptionGroup>);
    deletedAt: Date | null;
    name: LocaleString;
    code: string;
    translations: Array<Translation<ProductOptionGroup>>;
    options: ProductOption[];
    products: Product[];
    channels: Channel[];
    customFields: CustomProductOptionGroupFields;
}
