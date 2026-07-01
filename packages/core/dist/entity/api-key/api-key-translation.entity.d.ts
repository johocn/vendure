import { LanguageCode } from '@vendure/common/lib/generated-types';
import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Translation } from '../../common/types/locale-types';
import { HasCustomFields } from '../../config/custom-field/custom-field-types';
import { VendureEntity } from '../base/base.entity';
import { CustomApiKeyFieldsTranslation } from '../custom-entity-fields';
import { ApiKey } from './api-key.entity';
export declare class ApiKeyTranslation extends VendureEntity implements Translation<ApiKey>, HasCustomFields {
    constructor(input?: DeepPartial<Translation<ApiKey>>);
    languageCode: LanguageCode;
    base: ApiKey;
    customFields: CustomApiKeyFieldsTranslation;
    name: string;
}
