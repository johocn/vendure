import { LanguageCode } from '@vendure/common/lib/generated-types';
import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Translation } from '../../common/types/locale-types';
import { HasCustomFields } from '../../config/custom-field/custom-field-types';
import { VendureEntity } from '../base/base.entity';
import { CustomAssetFieldsTranslation } from '../custom-entity-fields';
import { Asset } from './asset.entity';
export declare class AssetTranslation extends VendureEntity implements Translation<Asset>, HasCustomFields {
    constructor(input?: DeepPartial<Translation<Asset>>);
    languageCode: LanguageCode;
    name: string;
    base: Asset;
    customFields: CustomAssetFieldsTranslation;
}
