import { AssetServerOptions } from '../types';
import { LocalAssetStorageStrategy } from './local-asset-storage-strategy';
/**
 * By default the AssetServerPlugin will configure and use the LocalStorageStrategy to persist Assets.
 */
export declare function defaultAssetStorageStrategyFactory(options: AssetServerOptions): LocalAssetStorageStrategy;
