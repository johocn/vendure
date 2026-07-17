import { Translated } from '../../../common/types/locale-types';
import { Channel } from '../../../entity/channel/channel.entity';
import { ProductOptionGroup } from '../../../entity/product-option-group/product-option-group.entity';
import { ProductOption } from '../../../entity/product-option/product-option.entity';
import { LocaleStringHydrator } from '../../../service/helpers/locale-string-hydrator/locale-string-hydrator';
import { ProductOptionGroupService } from '../../../service/services/product-option-group.service';
import { RequestContext } from '../../common/request-context';
export declare class ProductOptionGroupEntityResolver {
    private productOptionGroupService;
    private localeStringHydrator;
    constructor(productOptionGroupService: ProductOptionGroupService, localeStringHydrator: LocaleStringHydrator);
    name(ctx: RequestContext, optionGroup: ProductOptionGroup): Promise<string>;
    languageCode(ctx: RequestContext, optionGroup: ProductOptionGroup): Promise<string>;
    productCount(ctx: RequestContext, optionGroup: ProductOptionGroup): Promise<number>;
    options(ctx: RequestContext, optionGroup: Translated<ProductOptionGroup>): Promise<Array<Translated<ProductOption>>>;
}
export declare class ProductOptionGroupAdminEntityResolver {
    private productOptionGroupService;
    constructor(productOptionGroupService: ProductOptionGroupService);
    channels(ctx: RequestContext, optionGroup: ProductOptionGroup): Promise<Channel[]>;
}
