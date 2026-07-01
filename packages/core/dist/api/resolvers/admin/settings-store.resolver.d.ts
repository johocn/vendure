import { SetSettingsStoreValueResult } from '../../../config/settings-store/settings-store-types';
import { SettingsStoreService } from '../../../service/helpers/settings-store/settings-store.service';
import { RequestContext } from '../../common/request-context';
export declare class SettingsStoreInput {
    key: string;
    value: any;
}
/**
 * @description
 * Resolvers for settings store operations in the Admin API.
 */
export declare class SettingsStoreAdminResolver {
    private readonly settingsStoreService;
    constructor(settingsStoreService: SettingsStoreService);
    settingsStoreFieldDefinitions(ctx: RequestContext): Promise<{
        key: string;
        scopeType: import("@vendure/common/lib/generated-types").SettingsStoreScopeType;
        readonly: boolean;
        currentValue: import("@vendure/common/lib/shared-types").JsonCompatible<any>;
    }[]>;
    getSettingsStoreValue(ctx: RequestContext, key: string): Promise<any>;
    getSettingsStoreValues(ctx: RequestContext, keys: string[]): Promise<Record<string, any>>;
    setSettingsStoreValue(ctx: RequestContext, input: SettingsStoreInput): Promise<SetSettingsStoreValueResult>;
    setSettingsStoreValues(ctx: RequestContext, inputs: SettingsStoreInput[]): Promise<SetSettingsStoreValueResult[]>;
}
