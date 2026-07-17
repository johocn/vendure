import { QuerySlugForEntityArgs } from '@vendure/common/lib/generated-types';
import { EntitySlugService } from '../../../service/helpers/entity-slug.service';
import { RequestContext } from '../../common/request-context';
export declare class SlugResolver {
    private entitySlugService;
    constructor(entitySlugService: EntitySlugService);
    slugForEntity(ctx: RequestContext, args: QuerySlugForEntityArgs): Promise<string>;
}
