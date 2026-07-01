import { CreateApiKeyResult, DeletionResponse, MutationCreateApiKeyArgs, MutationDeleteApiKeysArgs, MutationRotateApiKeyArgs, MutationUpdateApiKeyArgs, QueryApiKeyArgs, QueryApiKeysArgs, RotateApiKeyResult } from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import { RelationPaths, RequestContext } from '../..';
import { Translated } from '../../../common';
import { ApiKey } from '../../../entity/api-key/api-key.entity';
import { ApiKeyService } from '../../../service/services/api-key.service';
export declare class ApiKeyResolver {
    private apiKeyService;
    constructor(apiKeyService: ApiKeyService);
    apiKey(ctx: RequestContext, { id }: QueryApiKeyArgs, relations: RelationPaths<ApiKey>): Promise<Translated<ApiKey> | null>;
    apiKeys(ctx: RequestContext, { options }: QueryApiKeysArgs, relations: RelationPaths<ApiKey>): Promise<PaginatedList<Translated<ApiKey>>>;
    createApiKey(ctx: RequestContext, { input }: MutationCreateApiKeyArgs): Promise<CreateApiKeyResult>;
    updateApiKey(ctx: RequestContext, { input }: MutationUpdateApiKeyArgs, relations: RelationPaths<ApiKey>): Promise<Translated<ApiKey>>;
    deleteApiKeys(ctx: RequestContext, { ids }: MutationDeleteApiKeysArgs): Promise<DeletionResponse[]>;
    rotateApiKey(ctx: RequestContext, { id }: MutationRotateApiKeyArgs): Promise<RotateApiKeyResult>;
}
