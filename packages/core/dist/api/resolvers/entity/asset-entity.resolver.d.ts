import { Asset } from '../../../entity/asset/asset.entity';
import { Tag } from '../../../entity/tag/tag.entity';
import { LocaleStringHydrator } from '../../../service/helpers/locale-string-hydrator/locale-string-hydrator';
import { TagService } from '../../../service/services/tag.service';
import { RequestContext } from '../../common/request-context';
export declare class AssetEntityResolver {
    private readonly tagService;
    private readonly localeStringHydrator;
    constructor(tagService: TagService, localeStringHydrator: LocaleStringHydrator);
    name(ctx: RequestContext, asset: Asset): Promise<string>;
    languageCode(ctx: RequestContext, asset: Asset): Promise<string>;
    translations(ctx: RequestContext, asset: Asset): Promise<any[]>;
    tags(ctx: RequestContext, asset: Asset): Promise<Tag[]>;
}
